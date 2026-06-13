import type { CorrectionListCatalog } from '@/lib/correction-lists/types'
import { parseCorrectionListText } from '@/lib/correction-lists/parse'

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(buffer)
  const doc = await getDocument({ data, useSystemFonts: true }).promise
  const pages: string[] = []

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push(text)
  }

  return pages.join(' ')
}

export async function parseCorrectionSheetFromPdf(
  buffer: Buffer
): Promise<CorrectionListCatalog> {
  const text = await extractTextFromPdfBuffer(buffer)
  return parseCorrectionListText(text)
}
