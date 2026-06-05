import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractPropertiesFromPdf } from '@/lib/analysis/extract-pdf'
import { buildSearchQuery } from '@/lib/analysis/build-query'
import { runComplianceCheck } from '@/lib/analysis/compliance'
import { getTokenForUrn } from '@/lib/aps/auth'
import {
  extractPropertiesFromUrn,
  fileExtensionFromName,
  isDwgExtension,
  isPropertiesEmpty,
} from '@/lib/aps/modelDerivative'
import { searchJurisdictionsForCity } from '@/lib/jurisdiction'
import { embedQuery } from '@/lib/voyage'
import type { Json } from '@/types/database'
import type { AnalysisProgressEvent, CodeSectionMatch } from '@/types/analysis'

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
}

function sseEncode(event: AnalysisProgressEvent): string {
  return `event: progress\ndata: ${JSON.stringify(event)}\n\n`
}

async function matchCodeSections(
  embedding: number[],
  jurisdiction: string,
  limit: number
): Promise<CodeSectionMatch[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('match_code_sections', {
    query_embedding: embedding,
    jurisdiction_filter: jurisdiction,
    match_count: limit,
  })

  if (error) {
    throw new Error(`Code search failed: ${error.message}`)
  }

  return (data ?? []) as CodeSectionMatch[]
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

  const { project_id, city, state, project_type, source_type, pdf_base64, aps_urn } =
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

        let properties
        if (source_type === 'pdf') {
          if (!pdf_base64) {
            throw new Error('pdf_base64 is required for PDF analysis')
          }
          properties = await extractPropertiesFromPdf(pdf_base64, {
            city,
            state,
            project_type,
          })
        } else {
          const urn = aps_urn ?? project.aps_urn
          if (!urn) {
            throw new Error('aps_urn is required for APS analysis')
          }
          const token = await getTokenForUrn(user.id, urn)
          const fileExt = project.original_file_name
            ? fileExtensionFromName(project.original_file_name)
            : ''
          properties = await extractPropertiesFromUrn(urn, token, {
            fileExtension: fileExt,
          })

          if (isPropertiesEmpty(properties)) {
            if (fileExt && isDwgExtension(fileExt)) {
              throw new Error(
                'DWG uploaded but no extractable building properties — try PDF upload or a Revit export.'
              )
            }
            throw new Error('No extractable building properties found in model.')
          }
        }

        await admin
          .from('analyses')
          .update({ extracted_properties: properties as unknown as Json })
          .eq('id', analysisId)

        send({
          stage: 'searching_codes',
          message: 'Searching applicable building codes…',
          analysis_id: analysisId,
        })

        const query = buildSearchQuery(properties, { city, state, project_type })
        const embedding = await embedQuery(query)
        const jurisdictions = searchJurisdictionsForCity(city, state)

        const seen = new Set<string>()
        let codeSections: CodeSectionMatch[] = []
        for (const jurisdiction of jurisdictions) {
          const matches = await matchCodeSections(embedding, jurisdiction, 20)
          for (const match of matches) {
            if (seen.has(match.id)) continue
            seen.add(match.id)
            codeSections.push(match)
          }
        }
        codeSections.sort((a, b) => b.similarity - a.similarity)
        codeSections = codeSections.slice(0, 20)

        send({
          stage: 'analyzing',
          message: 'Running compliance analysis…',
          analysis_id: analysisId,
        })

        const { violations, tokensUsed } = await runComplianceCheck(
          properties,
          codeSections,
          { city, state, project_type }
        )

        const violationCount = violations.filter((v) => v.severity === 'violation').length
        const warningCount = violations.filter((v) => v.severity === 'warning').length
        const passCount = violations.filter((v) => v.severity === 'pass').length

        if (violations.length > 0) {
          const rows = violations.map((v) => ({
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
            tokens_used: tokensUsed,
            completed_at: new Date().toISOString(),
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
