import Anthropic from '@anthropic-ai/sdk'
import type {
  CodeSectionMatch,
  ComplianceViolation,
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
  context: { city: string; state: string; project_type: string }
): Promise<{ violations: ComplianceViolation[]; tokensUsed: number }> {
  const client = getClient()

  const codeContext = codeSections
    .map(
      (s) =>
        `[${s.section}] ${s.title}\nText: ${s.full_text.slice(0, 1200)}`
    )
    .join('\n\n---\n\n')

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `You are a California building code compliance expert reviewing a ${context.project_type} project in ${context.city}, ${context.state}.

## Extracted building properties (JSON)
${JSON.stringify(properties, null, 2)}

## Relevant code sections
${codeContext}

## Task
Compare the extracted properties against the code sections. Return a JSON array of compliance findings. Each item must use this exact shape:

{
  "severity": "violation" | "warning" | "pass",
  "code_section": "section number e.g. R310.1",
  "code_title": "section title",
  "code_requirement": "what the code requires",
  "finding": "what was found in the model/plan",
  "recommendation": "specific fix or note",
  "element_name": "e.g. Bedroom 2 Window",
  "element_location": "room/level description for plan callout",
  "measured_value": "what was measured",
  "required_value": "code minimum/maximum",
  "confidence": "high" | "medium" | "low",
  "element_id": "APS dbId as string if known, else null"
}

Rules:
- Include violations and warnings for clear non-compliance
- Include pass items for major checks that clearly comply (at least 3 if applicable)
- Prefer dbId from properties.windows/doors/stairs when assigning element_id
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
  const violations = sanitizeViolations(raw)
  const tokensUsed =
    (message.usage?.input_tokens ?? 0) + (message.usage?.output_tokens ?? 0)

  return { violations, tokensUsed }
}

const VALID_SEVERITY = new Set(['violation', 'warning', 'pass'])
const VALID_CONFIDENCE = new Set(['high', 'medium', 'low'])

/**
 * The DB requires non-null text for code_section/title/requirement/finding/
 * recommendation, and a known severity. Coerce the model's output so a single
 * malformed item can't fail the whole insert or skew the counts.
 */
function sanitizeViolations(raw: unknown): ComplianceViolation[] {
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
      }
    })
}
