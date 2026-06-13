import Anthropic from '@anthropic-ai/sdk'

export const CLAUDE_MODEL = 'claude-sonnet-4-20250514'

export function getClaudeClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')
  return new Anthropic({ apiKey })
}

export function extractJsonObject<T>(text: string): T {
  const trimmed = text.trim()
  const objectMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!objectMatch) {
    throw new Error('Failed to parse JSON object from model response')
  }
  return JSON.parse(objectMatch[0]) as T
}

export function extractJsonArray<T>(text: string): T {
  const trimmed = text.trim()
  const arrayMatch = trimmed.match(/\[[\s\S]*\]/)
  if (!arrayMatch) {
    throw new Error('Failed to parse JSON array from model response')
  }
  return JSON.parse(arrayMatch[0]) as T
}
