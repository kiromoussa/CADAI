import { CLAUDE_MODEL, getClaudeClient } from '@/lib/analysis/claude-client'
import type { ExtractedProperties } from '@/types/analysis'
import type { ViolationRow } from '@/types/database'

export interface PlanChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface PlanChatResponse {
  answer: string
  code_citations: string[]
  sheet_reference: string | null
  confidence: 'High' | 'Medium' | 'Low'
}

export async function askPlanQuestion(
  question: string,
  context: {
    city: string
    state: string
    project_type: string
    properties?: ExtractedProperties | null
    violations: ViolationRow[]
    history?: PlanChatMessage[]
  }
): Promise<PlanChatResponse> {
  const client = getClaudeClient()

  const violationSummary = context.violations
    .filter((v) => v.severity !== 'pass')
    .slice(0, 40)
    .map(
      (v) =>
        `- [${v.severity}] ${v.code_section}: ${v.finding} (${v.element_location ?? 'location n/a'})`
    )
    .join('\n')

  const planContext = context.properties
    ? JSON.stringify(context.properties, null, 2).slice(0, 12000)
    : 'No extracted plan properties available.'

  const historyText =
    context.history?.slice(-6).map((m) => `${m.role}: ${m.content}`).join('\n') ?? ''

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: `You are FirstPass Chat, an AI code assistant for building plan review. Answer code-related questions with:
1. A direct answer (plain language)
2. Specific code section citations in format [Code Year § Section]
3. Reference to sheet or element in the plans when applicable
4. Confidence: High | Medium | Low

Never guess. If uncertain, say findings require verification with the jurisdiction's building official.
Return JSON only: { "answer": "...", "code_citations": ["..."], "sheet_reference": "..." | null, "confidence": "High"|"Medium"|"Low" }`,
    messages: [
      {
        role: 'user',
        content: `Project: ${context.project_type} in ${context.city}, ${context.state}

Plan properties:
${planContext}

Known compliance findings:
${violationSummary || 'None recorded yet.'}

${historyText ? `Prior conversation:\n${historyText}\n` : ''}
Question: ${question}`,
      },
    ],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no chat response')
  }

  try {
    const parsed = JSON.parse(
      textBlock.text.trim().match(/\{[\s\S]*\}/)?.[0] ?? textBlock.text
    ) as PlanChatResponse
    return parsed
  } catch {
    return {
      answer: textBlock.text.trim(),
      code_citations: [],
      sheet_reference: null,
      confidence: 'Medium',
    }
  }
}
