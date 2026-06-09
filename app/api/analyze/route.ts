import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  extractPropertiesFromPdf,
  isExtractedPropertiesEmpty,
} from '@/lib/analysis/extract-pdf'
import { buildSearchQuery, buildKeywordSearchQuery } from '@/lib/analysis/build-query'
import { runComplianceCheck } from '@/lib/analysis/compliance'
import {
  DISCIPLINE_CODE_BODIES,
  disciplineLabel,
  disciplinesWithContent,
  slicePropertiesByDiscipline,
} from '@/lib/analysis/disciplines'
import { getTokenForUrn } from '@/lib/aps/auth'
import {
  extractPropertiesFromUrn,
  fileExtensionFromName,
  isDwgExtension,
  isPropertiesEmpty,
} from '@/lib/aps/modelDerivative'
import {
  appliesLaAduCorrectionList,
  buildCorrectionListSearchQuery,
  getPinnedCorrectionListSections,
} from '@/lib/correction-lists/analysis-seed'
import { municipalCodeBodiesForJurisdiction } from '@/lib/analysis/code-bodies'
import { localJurisdictionForCity, searchJurisdictionsForCity } from '@/lib/jurisdiction'
import { embedQuery } from '@/lib/voyage'
import type { Json } from '@/types/database'
import type {
  AnalysisProgressEvent,
  CodeSearchCoverage,
  CodeSectionMatch,
  ComplianceViolation,
  Discipline,
  ExtractedProperties,
} from '@/types/analysis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface AnalyzeRequestBody {
  project_id: string
  city: string
  state: string
  project_type: string
  source_type: 'pdf' | 'aps'
  pdf_base64?: string
  aps_urn?: string
  file_name?: string
}

function sseEncode(event: AnalysisProgressEvent): string {
  return `event: progress\ndata: ${JSON.stringify(event)}\n\n`
}

async function matchCodeSections(
  embedding: number[],
  jurisdiction: string,
  limit: number,
  codeBodies?: string[]
): Promise<CodeSectionMatch[]> {
  const admin = createAdminClient()
  const baseArgs = {
    query_embedding: embedding,
    jurisdiction_filter: jurisdiction,
    match_count: limit,
  }

  if (codeBodies?.length) {
    const filtered = await admin.rpc('match_code_sections', {
      ...baseArgs,
      code_body_filter: codeBodies,
    })
    if (!filtered.error) {
      return (filtered.data ?? []) as CodeSectionMatch[]
    }
    const msg = filtered.error.message ?? ''
    const missingFilterOverload =
      msg.includes('code_body_filter') || msg.includes('schema cache')
    if (!missingFilterOverload) {
      throw new Error(`Code search failed: ${msg}`)
    }
  }

  const { data, error } = await admin.rpc('match_code_sections', baseArgs)
  if (error) {
    throw new Error(`Code search failed: ${error.message}`)
  }

  let matches = (data ?? []) as CodeSectionMatch[]
  if (codeBodies?.length) {
    const allowed = new Set(codeBodies)
    matches = matches.filter((m) => allowed.has(m.code_body))
  }
  return matches
}

async function searchCodesForDiscipline(
  properties: ExtractedProperties,
  context: { city: string; state: string; project_type: string },
  discipline: Discipline
): Promise<{ sections: CodeSectionMatch[]; coverage: CodeSearchCoverage }> {
  const queries = [
    buildSearchQuery(properties, context, { discipline }),
    buildKeywordSearchQuery(context, discipline),
  ]

  if (appliesLaAduCorrectionList(context.city, context.state, context.project_type)) {
    queries.push(buildCorrectionListSearchQuery(discipline, context))
  }

  const stateCodeBodies = DISCIPLINE_CODE_BODIES[discipline]
  const jurisdictions = searchJurisdictionsForCity(context.city, context.state)
  const localSlug = localJurisdictionForCity(context.city, context.state)

  const codeBodiesForJurisdiction = (jurisdiction: string): string[] => {
    const bodies = [...stateCodeBodies]
    if (jurisdiction === localSlug && localSlug) {
      const municipal = municipalCodeBodiesForJurisdiction(localSlug)
      for (const body of municipal) {
        if (!bodies.includes(body)) bodies.push(body)
      }
    }
    return bodies
  }

  const seen = new Set<string>()
  let codeSections: CodeSectionMatch[] = []

  if (appliesLaAduCorrectionList(context.city, context.state, context.project_type)) {
    for (const pinned of getPinnedCorrectionListSections(discipline)) {
      const key = pinned.id
      if (seen.has(key)) continue
      seen.add(key)
      codeSections.push(pinned)
    }
  }

  for (const query of queries) {
    const embedding = await embedQuery(query)
    for (const jurisdiction of jurisdictions) {
      const matches = await matchCodeSections(
        embedding,
        jurisdiction,
        jurisdiction === localSlug ? 40 : 30,
        codeBodiesForJurisdiction(jurisdiction)
      )
      for (const match of matches) {
        if (seen.has(match.id)) continue
        seen.add(match.id)
        codeSections.push(match)
      }
    }
  }

  codeSections.sort((a, b) => b.similarity - a.similarity)
  codeSections = codeSections.slice(0, 35)

  const coverage: CodeSearchCoverage = {
    discipline,
    sections_retrieved: codeSections.length,
    code_bodies: Array.from(new Set(codeSections.map((s) => s.code_body))),
    top_sections: codeSections.slice(0, 8).map((s) => ({
      section: s.section,
      title: s.title,
      code_body: s.code_body,
      similarity: s.similarity,
    })),
  }

  return { sections: codeSections, coverage }
}

function sheetNamesForDiscipline(
  properties: ExtractedProperties,
  discipline: Discipline
): string[] {
  return (
    properties.sheets
      ?.filter(
        (s) =>
          s.discipline === discipline ||
          (discipline === 'architectural' && s.discipline === 'general')
      )
      .map((s) => s.name) ?? []
  )
}

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  let body: AnalyzeRequestBody
  try {
    body = (await request.json()) as AnalyzeRequestBody
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  const { project_id, city, state, project_type, source_type, pdf_base64, aps_urn, file_name } =
    body

  if (!project_id || !city || !state || !project_type || !source_type) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
    })
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', project_id)
    .eq('user_id', user.id)
    .single()

  if (projectError || !project) {
    return new Response(JSON.stringify({ error: 'Project not found' }), { status: 404 })
  }

  const admin = createAdminClient()

  const { data: analysis, error: analysisError } = await admin
    .from('analyses')
    .insert({
      project_id,
      user_id: user.id,
      status: 'running',
      source_type,
      city,
      state,
      project_type,
      claude_model: 'claude-sonnet-4-20250514',
    })
    .select('id')
    .single()

  if (analysisError || !analysis) {
    return new Response(
      JSON.stringify({
        error: analysisError?.message ?? 'Failed to create analysis',
      }),
      { status: 500 }
    )
  }

  const analysisId = analysis.id

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      const send = (event: AnalysisProgressEvent) => {
        controller.enqueue(encoder.encode(sseEncode(event)))
      }

      try {
        send({
          stage: 'extracting',
          message: 'Extracting building properties from plan…',
          analysis_id: analysisId,
        })

        let properties: ExtractedProperties
        if (source_type === 'pdf') {
          if (!pdf_base64) {
            throw new Error('pdf_base64 is required for PDF analysis')
          }

          properties = await extractPropertiesFromPdf(pdf_base64, {
            city,
            state,
            project_type,
          })

          if (isExtractedPropertiesEmpty(properties)) {
            throw new Error(
              'Could not read rooms, doors, windows, or stairs from this PDF. CAD vector exports often work better after exporting with room labels and dimensions visible, or upload the original DWG/RVT file instead.'
            )
          }
        } else {
          const urn = aps_urn ?? project.aps_urn
          if (!urn) {
            throw new Error('aps_urn is required for APS analysis')
          }
          const token = await getTokenForUrn(user.id, urn)
          const fileExt = project.original_file_name
            ? fileExtensionFromName(project.original_file_name)
            : file_name
              ? fileExtensionFromName(file_name)
              : ''
          properties = await extractPropertiesFromUrn(urn, token, {
            fileExtension: fileExt,
            extractionContext: { city, state, project_type },
            onWaiting: (message) => {
              send({
                stage: 'extracting',
                message,
                analysis_id: analysisId,
              })
            },
            onProgress: (current, total, sheetName, discipline) => {
              send({
                stage: 'extracting',
                message: `Extracting sheet ${current} of ${total} (${disciplineLabel(discipline)} — ${sheetName})…`,
                analysis_id: analysisId,
                discipline,
                sheet_index: current,
                sheet_total: total,
              })
            },
          })

          if (isPropertiesEmpty(properties)) {
            const sheetCount = properties.sheets?.length ?? 0
            if (fileExt && isDwgExtension(fileExt)) {
              throw new Error(
                sheetCount > 0
                  ? `DWG has ${sheetCount} sheet(s) but no rooms, doors, or windows could be read — Autodesk may still be indexing the file, or the plan needs a PDF export. Wait 2–3 minutes and try again, or upload a PDF exported from your CAD tool.`
                  : 'Could not read building data from this DWG yet — if you just uploaded, wait a few minutes for translation to finish and run analysis again. Otherwise re-upload the file or export a PDF from your CAD tool.'
              )
            }
            throw new Error('No extractable building properties found in model.')
          }
        }

        await admin
          .from('analyses')
          .update({ extracted_properties: properties as unknown as Json })
          .eq('id', analysisId)

        const disciplines = disciplinesWithContent(properties, project_type)
        if (disciplines.length === 0) {
          throw new Error('No disciplines with extractable content found.')
        }

        const allViolations: ComplianceViolation[] = []
        const coverageLog: CodeSearchCoverage[] = []
        let totalTokens = 0

        for (const discipline of disciplines) {
          const slice = slicePropertiesByDiscipline(properties, discipline)

          send({
            stage: 'searching_codes',
            message: `Searching ${disciplineLabel(discipline)} code sections…`,
            analysis_id: analysisId,
            discipline,
          })

          const { sections: codeSections, coverage } = await searchCodesForDiscipline(
            slice,
            { city, state, project_type },
            discipline
          )
          coverageLog.push(coverage)

          send({
            stage: 'searching_codes',
            message: `Retrieved ${coverage.sections_retrieved} ${disciplineLabel(discipline)} sections (${coverage.code_bodies.join(', ') || 'all codes'})`,
            analysis_id: analysisId,
            discipline,
            code_coverage: coverage,
          })

          send({
            stage: 'analyzing',
            message: `Checking ${disciplineLabel(discipline)} compliance…`,
            analysis_id: analysisId,
            discipline,
          })

          const { violations, tokensUsed } = await runComplianceCheck(
            slice,
            codeSections,
            {
              city,
              state,
              project_type,
              discipline,
              sheetNames: sheetNamesForDiscipline(properties, discipline),
            }
          )

          totalTokens += tokensUsed
          allViolations.push(...violations)
        }

        const violationCount = allViolations.filter((v) => v.severity === 'violation').length
        const warningCount = allViolations.filter((v) => v.severity === 'warning').length
        const passCount = allViolations.filter((v) => v.severity === 'pass').length

        if (allViolations.length > 0) {
          const rows = allViolations.map((v) => ({
            analysis_id: analysisId,
            project_id,
            severity: v.severity,
            code_section: v.code_section,
            code_title: v.code_title,
            code_requirement: v.code_requirement,
            finding: v.finding,
            recommendation: v.recommendation,
            element_id: v.element_id != null ? String(v.element_id) : null,
            element_name: v.element_name ?? null,
            element_location: v.element_location ?? null,
            measured_value: v.measured_value ?? null,
            required_value: v.required_value ?? null,
            confidence: v.confidence ?? 'high',
            sheet_guid: v.sheet_guid ?? null,
            discipline: v.discipline ?? null,
          }))

          const { error: insertError } = await admin.from('violations').insert(rows)
          if (insertError) {
            throw new Error(`Failed to save violations: ${insertError.message}`)
          }
        }

        await admin
          .from('analyses')
          .update({
            status: 'complete',
            violation_count: violationCount,
            warning_count: warningCount,
            pass_count: passCount,
            tokens_used: totalTokens,
            completed_at: new Date().toISOString(),
            extracted_properties: {
              ...properties,
              _coverage: coverageLog,
            } as unknown as Json,
          })
          .eq('id', analysisId)

        send({
          stage: 'complete',
          message: 'Analysis complete',
          analysis_id: analysisId,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Analysis failed'
        await admin
          .from('analyses')
          .update({ status: 'error' })
          .eq('id', analysisId)

        controller.enqueue(
          encoder.encode(
            `event: progress\ndata: ${JSON.stringify({
              stage: 'error',
              message,
              analysis_id: analysisId,
              error: message,
            } satisfies AnalysisProgressEvent)}\n\n`
          )
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
