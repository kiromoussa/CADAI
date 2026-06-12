import { CLAUDE_MODEL, extractJsonObject, getClaudeClient } from '@/lib/analysis/claude-client'
import type { ViolationRow } from '@/types/database'

export interface ResolutionPathway {
  option: number
  title: string
  action_required: string
  satisfies_code_by: string
  design_impact: 'Low' | 'Medium' | 'High'
  cost_impact: 'Low' | 'Medium' | 'High'
  requires_variance: boolean
  notes: string
}

export interface ResolutionPathwaysResult {
  issue_id: string
  issue_summary: string
  code_citation: string
  pathways: ResolutionPathway[]
  recommended_option: number
  recommendation_rationale: string
}

export async function generateResolutionPathways(
  violation: ViolationRow,
  context: {
    city: string
    state: string
    project_type: string
  }
): Promise<ResolutionPathwaysResult> {
  const client = getClaudeClient()

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: `You are FirstPass Resolve, a building code resolution specialist. Given a specific code compliance issue, generate structured resolution pathways — multiple concrete options for how the design team can address the issue, with their trade-offs.

Each pathway must include:
- option (number starting at 1)
- title
- action_required (what changes are required to the drawings)
- satisfies_code_by (which code section it satisfies and how)
- design_impact: Low | Medium | High
- cost_impact: Low | Medium | High
- requires_variance: true | false
- notes

Return JSON only with keys: issue_id, issue_summary, code_citation, pathways, recommended_option, recommendation_rationale.`,
    messages: [
      {
        role: 'user',
        content: `Issue ID: ${violation.id}
Code: ${violation.code_section} — ${violation.code_title}
Requirement: ${violation.code_requirement}
Finding: ${violation.finding}
Current recommendation: ${violation.recommendation}
Measured: ${violation.measured_value ?? 'n/a'}
Required: ${violation.required_value ?? 'n/a'}

Building type: ${context.project_type}
Jurisdiction: ${context.city}, ${context.state}`,
      },
    ],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no resolution pathways')
  }

  const result = extractJsonObject<ResolutionPathwaysResult>(textBlock.text)
  result.issue_id = violation.id
  return result
}
