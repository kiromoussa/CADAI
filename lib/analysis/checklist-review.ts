import { CLAUDE_MODEL, extractJsonObject, getClaudeClient } from '@/lib/analysis/claude-client'
import type { ExtractedProperties } from '@/types/analysis'

export interface ChecklistItemResult {
  item_id: string
  item_description: string
  status: 'Pass' | 'Fail' | 'Needs Review'
  evidence: string
  notes: string
}

export interface ChecklistReviewResult {
  checklist_name: string
  date: string
  results: ChecklistItemResult[]
  summary: { pass: number; fail: number; needs_review: number }
  overall_status: 'Approved' | 'Approved with Conditions' | 'Rejected'
}

export async function runChecklistReview(
  checklistItems: string[],
  planData: ExtractedProperties | string,
  checklistName = 'Custom QA/QC Checklist'
): Promise<ChecklistReviewResult> {
  const client = getClaudeClient()

  const planText =
    typeof planData === 'string'
      ? planData
      : JSON.stringify(planData, null, 2).slice(0, 14000)

  const numbered = checklistItems
    .map((item, i) => `${i + 1}. ${item}`)
    .join('\n')

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 6144,
    system: `You are FirstPass Checklist Reviewer. Evaluate each checklist item against the plan data.

Only mark "Pass" when there is explicit evidence. When in doubt, use "Needs Review."

Return JSON:
{
  "checklist_name": "...",
  "date": "ISO date",
  "results": [{ "item_id": "CL-001", "item_description": "...", "status": "Pass|Fail|Needs Review", "evidence": "...", "notes": "..." }],
  "summary": { "pass": N, "fail": N, "needs_review": N },
  "overall_status": "Approved | Approved with Conditions | Rejected"
}`,
    messages: [
      {
        role: 'user',
        content: `Checklist name: ${checklistName}

Checklist:
${numbered}

Plan data:
${planText}`,
      },
    ],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no checklist results')
  }

  const result = extractJsonObject<ChecklistReviewResult>(textBlock.text)
  if (!result.date) {
    result.date = new Date().toISOString().slice(0, 10)
  }
  result.checklist_name = checklistName
  return result
}
