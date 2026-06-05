import Anthropic from '@anthropic-ai/sdk'
import type { ExtractedProperties } from '@/types/analysis'

const CLAUDE_MODEL = 'claude-sonnet-4-20250514'

const EXTRACTION_SCHEMA = `{
  "rooms": [{"name": "string", "area_sqft": number, "length_ft": number, "width_ft": number, "ceiling_height_ft": number, "level": "string", "windows": [{"name": "string", "width_in": number, "height_in": number, "sill_height_in": number}], "doors": [{"name": "string", "width_in": number, "height_in": number}]}],
  "windows": [{"name": "string", "width_in": number, "height_in": number, "sill_height_in": number, "level": "string"}],
  "doors": [{"name": "string", "width_in": number, "height_in": number, "level": "string"}],
  "stairs": [{"name": "string", "riser_height_in": number, "tread_depth_in": number, "width_in": number, "level": "string"}],
  "garage": {"attached": boolean, "door_count": number, "fire_separation": boolean},
  "project": {"name": "string", "address": "string", "city": "string", "state": "string", "building_type": "string", "total_area_sqft": number}
}`

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')
  return new Anthropic({ apiKey })
}

export async function extractPropertiesFromPdf(
  pdfBase64: string,
  context: { city: string; state: string; project_type: string }
): Promise<ExtractedProperties> {
  const client = getClient()

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64,
            },
          },
          {
            type: 'text',
            text: `You are a building code analyst reviewing a residential floor plan PDF for ${context.project_type} construction in ${context.city}, ${context.state}.

Extract all measurable building properties from this plan. Return ONLY valid JSON matching this schema (no markdown, no commentary):

${EXTRACTION_SCHEMA}

Rules:
- Convert dimensions to inches for windows/doors/stairs and square feet for areas when possible
- Include every labeled room, window, door, and stair you can identify
- Use null or omit fields you cannot determine
- For garage, infer from plan labels if present`,
          },
        ],
      },
    ],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text for PDF extraction')
  }

  const parsed = parseJsonResponse<Partial<ExtractedProperties>>(textBlock.text)
  return normalizeProperties(parsed)
}

/**
 * Claude is told to omit fields it can't determine, so any array may be missing
 * or null. Guarantee the array shape so downstream consumers can iterate safely.
 */
function normalizeProperties(
  parsed: Partial<ExtractedProperties> | null | undefined
): ExtractedProperties {
  const p = parsed ?? {}
  return {
    rooms: Array.isArray(p.rooms) ? p.rooms : [],
    windows: Array.isArray(p.windows) ? p.windows : [],
    doors: Array.isArray(p.doors) ? p.doors : [],
    stairs: Array.isArray(p.stairs) ? p.stairs : [],
    garage: p.garage,
    project: p.project,
  }
}

function parseJsonResponse<T>(text: string): T {
  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse Claude JSON response')
  }
  return JSON.parse(jsonMatch[0]) as T
}
