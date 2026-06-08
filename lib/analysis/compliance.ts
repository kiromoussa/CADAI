import Anthropic from '@anthropic-ai/sdk'
import { disciplineLabel } from '@/lib/analysis/disciplines'
import type {
  CodeSectionMatch,
  ComplianceViolation,
  Discipline,
  ExtractedProperties,
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

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `You are a California building code compliance expert reviewing the **${disciplineName}** portion of a ${context.project_type} project in ${context.city}, ${context.state}.
${sheetHint}

## Extracted properties (JSON)
${JSON.stringify(properties, null, 2)}

## Relevant code sections
${codeContext}

## Task
Compare the extracted ${disciplineName.toLowerCase()} properties against the code sections. Return a JSON array of compliance findings. Each item must use this exact shape:

{
  "severity": "violation" | "warning" | "pass",
  "code_section": "section number e.g. R310.1",
  "code_title": "section title",
  "code_requirement": "what the code requires",
  "finding": "what was found in the model/plan",
  "recommendation": "specific fix or note",
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
- Include violations and warnings for clear non-compliance
- Include pass items for major checks that clearly comply (at least 2 if applicable)
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

      return {
        severity,
        code_section: str(item.code_section),
        code_title: str(item.code_title),
        code_requirement: str(item.code_requirement),
        finding: str(item.finding),
        recommendation: str(item.recommendation),
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
      }
    })
}
