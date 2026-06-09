/**
 * Extracts PC.STR.Corr.Lst.20A correction items from PDF text and writes JSON catalog.
 * Usage: node scripts/extract-correction-list.mjs [pdf-path]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const defaultPdf = path.resolve(
  __dirname,
  '../../home/ubuntu/.cursor/projects/workspace/uploads/PC.STR.Corr.Lst.20A_c345.pdf'
)

const LIST_ID = 'PC/STR/Corr.Lst.20A'
const REVISION = '2025-10-01'

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

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim()
}

function extractCodeRefs(text) {
  const refs = new Set()
  for (const pattern of CODE_REF_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags)
    let match
    while ((match = re.exec(text)) !== null) {
      const cleaned = normalizeWhitespace(match[0].replace(/^\(|\)$/g, ''))
      if (cleaned.length >= 3 && !/^\d{1,2}$/.test(cleaned)) {
        refs.add(cleaned)
      }
    }
  }
  return [...refs]
}

function splitSections(partText) {
  const sections = []
  const re = /\b([A-K])\.\s+([A-Z][^]*?)(?=\b[A-K]\.\s+[A-Z]|$)/g
  let match
  while ((match = re.exec(partText)) !== null) {
    sections.push({
      letter: match[1],
      title: normalizeWhitespace(match[2].split(/\s+\d+\.\s+/)[0] ?? match[2].slice(0, 80)),
      body: match[2],
    })
  }
  return sections
}

function splitNumberedItems(sectionBody, sectionTitle) {
  const items = []
  const chunks = sectionBody.split(/(?=\s\d+\.\s+)/)
  for (const chunk of chunks) {
    const m = chunk.match(/^\s*(\d+)\.\s+([\s\S]+)/)
    if (!m) continue
    const text = normalizeWhitespace(m[2])
    if (!text || text.length < 10) continue
    items.push({
      number: Number(m[1]),
      text,
      code_refs: extractCodeRefs(text),
      section_title: sectionTitle,
    })
  }
  return items
}

function parseCorrectionListText(fullText) {
  const flat = normalizeWhitespace(fullText)

  const supplementalForms = [...flat.matchAll(/PC\/(?:STR|GRAD)\/[\w.]+/g)].map((m) => m[0])
  const bulletins = [...flat.matchAll(/P\/(?:GI|BC|ZC)\s+2023-\d{3}/g)].map((m) => m[0])

  const allItems = []
  const partsMeta = []

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
          section_title: item.section_title,
          number: item.number,
          text: item.text,
          code_refs: item.code_refs,
        })
      }
    }
  }

  return {
    list_id: LIST_ID,
    revision: REVISION,
    title:
      'Accessory Dwelling Unit (ADU), Junior Accessory Dwelling Unit (JADU), Movable Tiny House (MTH) Correction Sheet',
    jurisdiction: 'los_angeles_ca',
    code_year: 2023,
    forms: [...new Set(supplementalForms)],
    information_bulletins: [...new Set(bulletins)],
    parts: partsMeta,
    items: allItems,
    total_items: allItems.length,
    unique_code_refs: [...new Set(allItems.flatMap((i) => i.code_refs))].sort(),
  }
}

async function extractPdfText(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await getDocument({ data, useSystemFonts: true }).promise
  const pages = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
    pages.push(text)
  }
  return pages.join(' ')
}

async function main() {
  const pdfPath = process.argv[2] ?? defaultPdf
  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF not found: ${pdfPath}`)
    process.exit(1)
  }

  const text = await extractPdfText(pdfPath)
  const catalog = parseCorrectionListText(text)
  const outPath = path.resolve(__dirname, '../lib/correction-lists/data/pc-str-corr-lst-20a.json')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2))
  console.log(`Wrote ${catalog.total_items} items, ${catalog.unique_code_refs.length} unique code refs`)
  console.log(`Forms: ${catalog.forms.length}, Bulletins: ${catalog.information_bulletins.length}`)
  console.log(`Output: ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
