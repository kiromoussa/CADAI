import { CLAUDE_MODEL, extractJsonObject, getClaudeClient } from '@/lib/analysis/claude-client'
import type { ViolationRow } from '@/types/database'

export interface VersionDiffResult {
  revision_summary: {
    sheets_changed: string[]
    elements_modified: string[]
    change_count: number
  }
  issues_resolved: Array<{ issue_id: string; how_resolved: string }>
  new_issues_introduced: Array<{
    severity: string
    code_section: string
    finding: string
    element_location?: string
  }>
  no_review_required: string[]
  re_review_recommendation: string
}

function violationDigest(violations: ViolationRow[]): string {
  return violations
    .filter((v) => v.severity !== 'pass')
    .map(
      (v) =>
        `[${v.id}] ${v.severity} ${v.code_section}: ${v.finding} @ ${v.element_location ?? 'n/a'}`
    )
    .join('\n')
}

export async function compareAnalysisVersions(
  priorViolations: ViolationRow[],
  currentViolations: ViolationRow[],
  context?: { prior_label?: string; current_label?: string }
): Promise<VersionDiffResult> {
  const client = getClaudeClient()

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: `You are FirstPass VersionDiff. Compare two plan review issue lists and identify what changed between revisions.

Return JSON:
{
  "revision_summary": { "sheets_changed": [], "elements_modified": [], "change_count": N },
  "issues_resolved": [{ "issue_id": "...", "how_resolved": "..." }],
  "new_issues_introduced": [{ "severity": "...", "code_section": "...", "finding": "...", "element_location": "..." }],
  "no_review_required": ["sheet names unchanged"],
  "re_review_recommendation": "Only re-review sheets: [...]"
}`,
    messages: [
      {
        role: 'user',
        content: `Version 1 (${context?.prior_label ?? 'prior'}):
${violationDigest(priorViolations) || 'No issues.'}

Version 2 (${context?.current_label ?? 'current'}):
${violationDigest(currentViolations) || 'No issues.'}`,
      },
    ],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no version diff')
  }

  return extractJsonObject<VersionDiffResult>(textBlock.text)
}
