import Anthropic from '@anthropic-ai/sdk'
import { disciplineLabel } from '@/lib/analysis/disciplines'
import { appliesLaAduCorrectionList } from '@/lib/correction-lists/analysis-seed'
import { PC_STR_CORR_LST_20A } from '@/lib/correction-lists/catalog'
import type {
  CodeSectionMatch,
  ComplianceViolation,
  Discipline,
  ExtractedProperties,
  ResolutionPathwaySummary,
} from '@/types/analysis'

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')
  return new Anthropic({ apiKey })
}

export async function runComplianceCheck(
  properties: ExtractedProperties,
  codeSections: CodeSectionMatch[],
  context: {
    city: string
    state: string
    project_type: string
    discipline?: Discipline
    sheetNames?: string[]
  }
): Promise<{ violations: ComplianceViolation[]; tokensUsed: number }> {
  const client = getClient()
  const discipline = context.discipline ?? 'architectural'
  const disciplineName = disciplineLabel(discipline)

  const codeContext = codeSections
    .map(
      (s) =>
        `[${s.section}] ${s.title} (${s.code_body})\nText: ${s.full_text.slice(0, 1200)}`
    )
    .join('\n\n---\n\n')

  const sheetHint =
    context.sheetNames?.length ?
      `Sheets in scope: ${context.sheetNames.join(', ')}.`
    : ''

  const laAduChecklistHint =
    appliesLaAduCorrectionList(context.city, context.state, context.project_type) ?
      `\n## LA City ADU plan check baseline (${PC_STR_CORR_LST_20A.list_id})
This project is in Los Angeles and subject to the city's ADU/JADU/MTH plan check correction checklist. Retrieved code sections may include Los Angeles Municipal Code (LAMC), Los Angeles Building/Residential Code (LABC/LARC), and California state codes. Apply them against the uploaded plans the same way a plan checker would — cover egress, ADU zoning (setbacks, height, parking), garage separation, fire/life safety, structural, and energy requirements.\n`
    : ''

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `You are a California building code compliance expert reviewing the **${disciplineName}** portion of a ${context.project_type} project in ${context.city}, ${context.state}.
${sheetHint}${laAduChecklistHint}

## Extracted properties (JSON)
${JSON.stringify(properties, null, 2)}

## Relevant code sections
${codeContext}

## Task
Compare the extracted ${disciplineName.toLowerCase()} properties against the code sections. Return a JSON array of compliance findings.

**FirstPass rule:** Every violation and warning MUST include resolution pathways — never return a bare flag. If you cannot suggest at least one credible pathway, set requires_manual_review to true.

Each item must use this exact shape:

{
  "severity": "violation" | "warning" | "pass",
  "code_section": "section number e.g. R310.1",
  "code_title": "section title",
  "code_requirement": "what the code requires",
  "finding": "what was found in the model/plan",
  "recommendation": "the recommended resolution action (same as recommended pathway action)",
  "recommended_action": "one-line summary of the best fix",
  "recommended_pathway": 1,
  "resolution_pathways": [
    {
      "option": 1,
      "title": "short option title",
      "action_required": "specific drawing changes",
      "satisfies_code_by": "how this satisfies the code",
      "design_impact": "Low" | "Medium" | "High",
      "cost_impact": "Low" | "Medium" | "High",
      "requires_variance": false,
      "notes": "optional"
    }
  ],
  "requires_manual_review": false,
  "element_name": "e.g. Bedroom 2 Window",
  "element_location": "Sheet name and room/level description for plan callout",
  "measured_value": "what was measured",
  "required_value": "code minimum/maximum",
  "confidence": "high" | "medium" | "low",
  "element_id": "APS dbId as string if known, else null",
  "sheet_guid": "sheet_guid from properties if known, else null",
  "discipline": "${discipline}"
}

Rules:
- Focus only on ${disciplineName} compliance for this pass
- Include violations and warnings for clear non-compliance — each with 2-4 resolution_pathways
- Include pass items for major checks that clearly comply (at least 2 if applicable) — pass items omit resolution_pathways
- recommended_pathway must match one option number in resolution_pathways
- If no credible pathway exists, set requires_manual_review true and resolution_pathways to []
- Prefer dbId from properties when assigning element_id
- Include sheet_guid from entity sheet_guid fields when available
- Return ONLY the JSON array, no markdown`,
      },
    ],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no compliance results')
  }

  const trimmed = textBlock.text.trim()
  const arrayMatch = trimmed.match(/\[[\s\S]*\]/)
  if (!arrayMatch) {
    throw new Error('Failed to parse compliance JSON array')
  }

  const raw = JSON.parse(arrayMatch[0]) as unknown
  const violations = sanitizeViolations(raw, discipline)
  const tokensUsed =
    (message.usage?.input_tokens ?? 0) + (message.usage?.output_tokens ?? 0)

  return { violations, tokensUsed }
}

const VALID_SEVERITY = new Set(['violation', 'warning', 'pass'])
const VALID_CONFIDENCE = new Set(['high', 'medium', 'low'])
const VALID_DISCIPLINE = new Set([
  'architectural',
  'structural',
  'roof',
  'electrical',
  'plumbing',
  'mechanical',
  'fire',
  'green',
  'general',
])

const VALID_IMPACT = new Set(['Low', 'Medium', 'High'])

function sanitizePathways(raw: unknown): ResolutionPathwaySummary[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
    .map((p, i) => ({
      option: typeof p.option === 'number' ? p.option : i + 1,
      title: String(p.title ?? `Option ${i + 1}`),
      action_required: String(p.action_required ?? ''),
      satisfies_code_by:
        p.satisfies_code_by != null ? String(p.satisfies_code_by) : undefined,
      design_impact: VALID_IMPACT.has(p.design_impact as string)
        ? (p.design_impact as ResolutionPathwaySummary['design_impact'])
        : 'Medium',
      cost_impact: VALID_IMPACT.has(p.cost_impact as string)
        ? (p.cost_impact as ResolutionPathwaySummary['cost_impact'])
        : 'Medium',
      requires_variance: Boolean(p.requires_variance),
      notes: p.notes != null ? String(p.notes) : undefined,
    }))
    .filter((p) => p.action_required.length > 0)
}

function sanitizeViolations(
  raw: unknown,
  defaultDiscipline: Discipline
): ComplianceViolation[] {
  if (!Array.isArray(raw)) return []

  const str = (value: unknown): string =>
    typeof value === 'string' ? value : value == null ? '' : String(value)

  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => {
      const severity = VALID_SEVERITY.has(item.severity as string)
        ? (item.severity as ComplianceViolation['severity'])
        : 'warning'
      const confidence = VALID_CONFIDENCE.has(item.confidence as string)
        ? (item.confidence as ComplianceViolation['confidence'])
        : 'medium'
      const discipline = VALID_DISCIPLINE.has(item.discipline as string)
        ? (item.discipline as Discipline)
        : defaultDiscipline

      const resolution_pathways = sanitizePathways(item.resolution_pathways)
      const requires_manual_review =
        severity !== 'pass' &&
        (Boolean(item.requires_manual_review) || resolution_pathways.length === 0)

      const recommended_pathway =
        typeof item.recommended_pathway === 'number'
          ? item.recommended_pathway
          : resolution_pathways[0]?.option

      const recommended_action =
        item.recommended_action != null
          ? str(item.recommended_action)
          : resolution_pathways.find((p) => p.option === recommended_pathway)
              ?.action_required ?? str(item.recommendation)

      return {
        severity,
        code_section: str(item.code_section),
        code_title: str(item.code_title),
        code_requirement: str(item.code_requirement),
        finding: str(item.finding),
        recommendation: recommended_action || str(item.recommendation),
        element_name: item.element_name != null ? str(item.element_name) : undefined,
        element_location:
          item.element_location != null ? str(item.element_location) : undefined,
        measured_value:
          item.measured_value != null ? str(item.measured_value) : undefined,
        required_value:
          item.required_value != null ? str(item.required_value) : undefined,
        confidence,
        element_id: item.element_id != null ? str(item.element_id) : null,
        sheet_guid: item.sheet_guid != null ? str(item.sheet_guid) : null,
        discipline,
        resolution_pathways:
          severity === 'pass' ? undefined : resolution_pathways,
        recommended_pathway:
          severity === 'pass' ? undefined : recommended_pathway,
        recommended_action:
          severity === 'pass' ? undefined : recommended_action,
        requires_manual_review:
          severity === 'pass' ? false : requires_manual_review,
      }
    })
}
