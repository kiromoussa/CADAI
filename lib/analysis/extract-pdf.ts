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

function extractionPrompt(context: {
  city: string
  state: string
  project_type: string
}, source: 'pdf' | 'image'): string {
  const sourceLabel =
    source === 'pdf'
      ? 'floor plan PDF (may be a CAD vector export with linework and annotations)'
      : 'floor plan image'

  return `You are a building code analyst reviewing a residential ${sourceLabel} for ${context.project_type} construction in ${context.city}, ${context.state}.

Extract all measurable building properties from this plan. Return ONLY valid JSON matching this schema (no markdown, no commentary):

${EXTRACTION_SCHEMA}

Rules:
- Read room labels, dimensions, door/window tags, and stair notes from the drawing even when text is sparse or embedded in CAD linework
- Look for door swing arcs, window symbols (parallel lines in walls), and stair tread/riser annotations
- Infer room names from labels like "BR", "BED", "KITCHEN", "GAR", "BATH", "LR", "DR", etc. when full names are not shown
- Count each distinct door opening, window opening, and stair run even if dimensions are missing — use placeholder names like "Door 1", "Window 1"
- Convert dimensions to inches for windows/doors/stairs and square feet for areas when possible
- Include every labeled room, window, door, and stair you can identify — partial data is better than omitting entities
- Use null or omit fields you cannot determine
- For garage, infer from plan labels if present`
}

export function isExtractedPropertiesEmpty(properties: ExtractedProperties): boolean {
  return (
    properties.rooms.length +
      properties.windows.length +
      properties.doors.length +
      properties.stairs.length ===
    0
  )
}

/** CAD PDF exports often return rooms but miss openings in the document API pass. */
export function needsVisionFallback(properties: ExtractedProperties): boolean {
  if (isExtractedPropertiesEmpty(properties)) return true
  const hasRooms = properties.rooms.length > 0
  const openings =
    properties.windows.length + properties.doors.length + properties.stairs.length
  return hasRooms && openings === 0
}

function mergeExtractedProperties(parts: ExtractedProperties[]): ExtractedProperties {
  return {
    rooms: parts.flatMap((p) => p.rooms),
    windows: parts.flatMap((p) => p.windows),
    doors: parts.flatMap((p) => p.doors),
    stairs: parts.flatMap((p) => p.stairs),
    garage: parts.find((p) => p.garage)?.garage,
    project: parts.find((p) => p.project)?.project,
    sheets: parts.flatMap((p) => p.sheets ?? []),
  }
}

async function extractPropertiesFromPdfDocument(
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
            text: extractionPrompt(context, 'pdf'),
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

export type PdfExtractionOptions = {
  /** Skip pdf.js + canvas rendering (APS DWG PDF derivatives often crash native render). */
  skipCanvasVision?: boolean
}

/** Document API only — safe for APS-translated PDFs from DWG. */
export async function extractPropertiesFromPdfDocumentOnly(
  pdfBase64: string,
  context: { city: string; state: string; project_type: string }
): Promise<ExtractedProperties> {
  return extractPropertiesFromPdfDocument(pdfBase64, context)
}

export async function extractPropertiesFromPdf(
  pdfBase64: string,
  context: { city: string; state: string; project_type: string },
  options?: PdfExtractionOptions
): Promise<ExtractedProperties> {
  const fromDocument = await extractPropertiesFromPdfDocument(pdfBase64, context)
  if (options?.skipCanvasVision || !needsVisionFallback(fromDocument)) {
    return fromDocument
  }

  try {
    const { renderPdfToPngPages } = await import('@/lib/analysis/pdf-render.server')
    const pngPages = await renderPdfToPngPages(pdfBase64)
    const parts: ExtractedProperties[] = []
    for (const png of pngPages) {
      parts.push(await extractPropertiesFromPlanImage(png, context))
    }
    const fromVision = mergeExtractedProperties(parts)

    if (isExtractedPropertiesEmpty(fromVision)) {
      return fromDocument
    }
    if (isExtractedPropertiesEmpty(fromDocument)) {
      return fromVision
    }
    return mergeExtractedProperties([fromDocument, fromVision])
  } catch (err) {
    console.warn('[extract-pdf] Canvas vision fallback failed, using document pass only:', err)
    return fromDocument
  }
}

export async function extractPropertiesFromPlanImage(
  pngBase64: string,
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
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: pngBase64,
            },
          },
          {
            type: 'text',
            text: extractionPrompt(context, 'image'),
          },
        ],
      },
    ],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text for plan image extraction')
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
