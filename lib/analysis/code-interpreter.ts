import { CLAUDE_MODEL, getClaudeClient } from '@/lib/analysis/claude-client'

export interface CodeInterpretation {
  section: string
  plain_language: string
  applies_to: string
  common_mistakes: string[]
  related_sections: string[]
  example: string
  mandatory_note: string | null
}

export async function interpretCodeSection(
  section: string,
  context?: {
    building_type?: string
    occupancy?: string
    jurisdiction?: string
  }
): Promise<CodeInterpretation> {
  const client = getClaudeClient()

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 3072,
    system: `You are FirstPass Code Interpreter. Explain building code sections clearly for architects and engineers.

Return JSON only:
{
  "section": "cited section",
  "plain_language": "what the section requires",
  "applies_to": "building types, occupancies, conditions",
  "common_mistakes": ["..."],
  "related_sections": ["..."],
  "example": "realistic scenario",
  "mandatory_note": "note about shall vs should, or state amendments, or null"
}

Do not fabricate section numbers. If the section is ambiguous, note that verification is required.`,
    messages: [
      {
        role: 'user',
        content: `Explain ${section} as it applies to:
Building type: ${context?.building_type ?? 'general commercial/residential'}
Occupancy: ${context?.occupancy ?? 'not specified'}
Jurisdiction: ${context?.jurisdiction ?? 'California (Title 24 / IBC adopted)'}`,
      },
    ],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no code interpretation')
  }

  try {
    return JSON.parse(
      textBlock.text.trim().match(/\{[\s\S]*\}/)?.[0] ?? textBlock.text
    ) as CodeInterpretation
  } catch {
    return {
      section,
      plain_language: textBlock.text.trim(),
      applies_to: context?.building_type ?? 'General',
      common_mistakes: [],
      related_sections: [],
      example: '',
      mandatory_note: null,
    }
  }
}
