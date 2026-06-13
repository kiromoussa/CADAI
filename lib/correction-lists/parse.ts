import type { CorrectionListCatalog, CorrectionListItem } from '@/lib/correction-lists/types'

const PART_MARKERS = [
  { part: 'I', title: 'GENERAL REQUIREMENTS', pattern: /PART\s+I\.\s*GENERAL\s+REQUIREMENTS/i },
  { part: 'II', title: 'DEVELOPMENT STANDARDS', pattern: /PART\s+II\.\s*DEVELOPMENT\s+STANDARDS/i },
  {
    part: 'III',
    title: 'BUILDING AND RESIDENTIAL CODE REQUIREMENTS',
    pattern: /PART\s+III\.\s*BUILDING\s+AND\s+RESIDENTIAL\s+CODE\s+REQUIREMENTS/i,
  },
]

const CODE_REF_PATTERNS = [
  /\bLAMC\s+[\d.]+[A-Za-z]?[\d().,\s&/-]*/gi,
  /\bGC\s*§\s*[\d.()a-zA-Z,\s&/-]+/gi,
  /\bLABC\s+[\d.]+[A-Za-z]?[\d().,\s&/-]*/gi,
  /\bLARC\s+[\w.]+/gi,
  /\bLAPC\s+[\d.]+/gi,
  /\bOrdinance\s+[\d,]+/gi,
  /\((?:\d{3,4}(?:\.\d+)*|R\d{3}(?:\.\d+)*|Table\s+[\w.()]+)(?:[,\s&]+(?:\d{3,4}(?:\.\d+)*|R\d{3}(?:\.\d+)*|Table\s+[\w.()]+|Sec\.?\s*[\d.]+))*\)/gi,
  /\bR\d{3}(?:\.\d+)+/gi,
  /\b\d{3,4}\.\d+(?:\.\d+)*/g,
]

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function extractCodeRefsFromText(text: string): string[] {
  const refs = new Set<string>()
  for (const pattern of CODE_REF_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags)
    let match: RegExpExecArray | null
    while ((match = re.exec(text)) !== null) {
      const cleaned = normalizeWhitespace(match[0].replace(/^\(|\)$/g, ''))
      if (cleaned.length >= 3 && !/^\d{1,2}$/.test(cleaned)) {
        refs.add(cleaned)
      }
    }
  }
  return Array.from(refs)
}

function splitSections(partText: string) {
  const sections: Array<{ letter: string; title: string; body: string }> = []
  const re = /\b([A-K])\.\s+([A-Z][^]*?)(?=\b[A-K]\.\s+[A-Z]|$)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(partText)) !== null) {
    sections.push({
      letter: match[1],
      title: normalizeWhitespace(match[2].split(/\s+\d+\.\s+/)[0] ?? match[2].slice(0, 80)),
      body: match[2],
    })
  }
  return sections
}

function splitNumberedItems(
  sectionBody: string,
  sectionTitle: string
): Array<{ number: number; text: string; code_refs: string[] }> {
  const items: Array<{ number: number; text: string; code_refs: string[] }> = []
  const chunks = sectionBody.split(/(?=\s\d+\.\s+)/)
  for (const chunk of chunks) {
    const m = chunk.match(/^\s*(\d+)\.\s+([\s\S]+)/)
    if (!m) continue
    const text = normalizeWhitespace(m[2])
    if (!text || text.length < 10) continue
    items.push({
      number: Number(m[1]),
      text,
      code_refs: extractCodeRefsFromText(text),
    })
  }
  return items
}

export function parseCorrectionListText(fullText: string): CorrectionListCatalog {
  const flat = normalizeWhitespace(fullText)

  const supplementalForms = Array.from(
    flat.matchAll(/PC\/(?:STR|GRAD)\/[\w.]+/g)
  ).map((m) => m[0])
  const bulletins = [
    ...Array.from(flat.matchAll(/P\/(?:GI|BC|ZC)\s+202\s*3-\d{3}/g)),
    ...Array.from(flat.matchAll(/P\/(?:GI|BC|ZC)\s+2023-\d{3}/g)),
  ].map((m) => m[0].replace(/\s+/g, ''))

  const allItems: CorrectionListItem[] = []
  const partsMeta: CorrectionListCatalog['parts'] = []

  for (let i = 0; i < PART_MARKERS.length; i++) {
    const marker = PART_MARKERS[i]
    const start = flat.search(marker.pattern)
    if (start === -1) continue
    const end =
      i + 1 < PART_MARKERS.length ?
        flat.search(PART_MARKERS[i + 1].pattern)
      : flat.search(/ADDITIONAL CORRECTIONS:/i)
    const partText = flat.slice(start, end === -1 ? undefined : end)
    partsMeta.push({ part: marker.part, title: marker.title })

    const sections = splitSections(partText)
    for (const section of sections) {
      const numbered = splitNumberedItems(section.body, section.title)
      for (const item of numbered) {
        allItems.push({
          id: `${marker.part}-${section.letter}-${item.number}`,
          part: marker.part,
          section: section.letter,
          section_title: section.title,
          number: item.number,
          text: item.text,
          code_refs: item.code_refs,
        })
      }
    }
  }

  return {
    list_id: 'PC/STR/Corr.Lst.20A',
    revision: '2025-10-01',
    title:
      'Accessory Dwelling Unit (ADU), Junior Accessory Dwelling Unit (JADU), Movable Tiny House (MTH) Correction Sheet',
    jurisdiction: 'los_angeles_ca',
    code_year: 2023,
    forms: Array.from(new Set(supplementalForms)),
    information_bulletins: Array.from(new Set(bulletins)),
    parts: partsMeta,
    items: allItems,
    total_items: allItems.length,
    unique_code_refs: Array.from(new Set(allItems.flatMap((i) => i.code_refs))).sort(),
  }
}

export function matchParsedToCatalog(
  parsed: CorrectionListCatalog,
  catalog: CorrectionListCatalog
): { matched: number; missing: string[] } {
  const catalogIds = new Set(catalog.items.map((i) => i.id))
  const parsedIds = parsed.items.map((i) => i.id)
  const missing = parsedIds.filter((id) => !catalogIds.has(id))
  const matched = parsedIds.filter((id) => catalogIds.has(id)).length
  return { matched, missing }
}
