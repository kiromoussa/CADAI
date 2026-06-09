import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PC_STR_CORR_LST_20A } from '@/lib/correction-lists/catalog'
import { collapseSectionDigits, normalizeCodeRef, normalizeCodeRefs } from '@/lib/correction-lists/code-refs'
import { detectCorrectionSheet } from '@/lib/correction-lists/detect'
import { lookupCodeRef } from '@/lib/correction-lists/lookup'
import { parseCorrectionListText } from '@/lib/correction-lists/parse'
import { parseCorrectionSheetFromPdf } from '@/lib/correction-lists/parse-pdf'
import {
  summarizeVerification,
  verifyCatalogCodeCoverage,
  verifyUploadedCorrectionSheet,
} from '@/lib/correction-lists/verify'

const PDF_PATH = path.resolve(
  process.cwd(),
  '../home/ubuntu/.cursor/projects/workspace/uploads/PC.STR.Corr.Lst.20A_c345.pdf'
)

const FALLBACK_PDF = path.resolve(
  process.cwd(),
  'test-fixtures/PC.STR.Corr.Lst.20A.pdf'
)

function resolvePdfPath(): string | null {
  if (fs.existsSync(PDF_PATH)) return PDF_PATH
  if (fs.existsSync(FALLBACK_PDF)) return FALLBACK_PDF
  return null
}

describe('PC.STR.Corr.Lst.20A catalog (no PDF)', () => {
  it('loads the full correction list with all parts', () => {
    expect(PC_STR_CORR_LST_20A.list_id).toBe('PC/STR/Corr.Lst.20A')
    expect(PC_STR_CORR_LST_20A.parts).toHaveLength(3)
    expect(PC_STR_CORR_LST_20A.total_items).toBeGreaterThanOrEqual(150)
    expect(PC_STR_CORR_LST_20A.forms).toContain('PC/STR/Aff.45')
  })

  it('includes correction items from all three parts', () => {
    const parts = new Set(PC_STR_CORR_LST_20A.items.map((i) => i.part))
    expect(parts).toEqual(new Set(['I', 'II', 'III']))
  })

  it('normalizes OCR-spaced government code references', () => {
    expect(collapseSectionDigits('6 6323')).toBe('66323')
    const ref = normalizeCodeRef('GC § 6 6323(a)(2)')
    expect(ref.family).toBe('government')
    expect(ref.section).toContain('66323')
  })

  it('resolves California Residential and Building code sections from chunks', () => {
    const residential = lookupCodeRef(normalizeCodeRef('R302.6'))
    const building = lookupCodeRef(normalizeCodeRef('406.3.2'))
    expect(residential.found).toBe(true)
    expect(residential.source).toBe('chunk')
    expect(building.found).toBe(true)
  })

  it('marks LA municipal references as local-only (not in CA chunk index)', () => {
    const lamc = lookupCodeRef(normalizeCodeRef('LAMC 57.09.03'))
    expect(lamc.found).toBe(true)
    expect(lamc.source).toBe('local_only')
  })

  it('verifies catalog code coverage without any upload', () => {
    const result = verifyCatalogCodeCoverage()
    expect(result.catalog_items).toBe(PC_STR_CORR_LST_20A.total_items)
    expect(result.code_refs_total).toBeGreaterThan(50)
    expect(result.coverage_percent).toBeGreaterThanOrEqual(70)
    const summary = summarizeVerification(result)
    expect(summary.message).toContain('PC/STR/Corr.Lst.20A')
  })

  it('deduplicates compound code references', () => {
    const refs = normalizeCodeRefs(['406.3.2, R302.6', 'R302.6'])
    const sections = refs.map((r) => r.section)
    expect(sections).toContain('406.3.2')
    expect(sections).toContain('R302.6')
    expect(refs).toHaveLength(2)
  })
})

describe('correction sheet upload matching (PDF)', () => {
  const pdfPath = resolvePdfPath()

  it.skipIf(!pdfPath)('detects PC.STR.Corr.Lst.20A from uploaded PDF', async () => {
    const buffer = fs.readFileSync(pdfPath!)
    const parsed = await parseCorrectionSheetFromPdf(buffer)
    const text = parsed.items.map((i) => i.text).join(' ')
    const detection = detectCorrectionSheet(text)

    expect(detection.is_correction_sheet).toBe(true)
    expect(detection.list_id).toBe('PC/STR/Corr.Lst.20A')
    expect(parsed.total_items).toBeGreaterThanOrEqual(150)
  })

  it.skipIf(!pdfPath)('matches parsed PDF items to embedded catalog', async () => {
    const buffer = fs.readFileSync(pdfPath!)
    const { extractTextFromPdfBuffer } = await import('@/lib/correction-lists/parse-pdf')
    const flatText = await extractTextFromPdfBuffer(buffer)
    const result = verifyUploadedCorrectionSheet(flatText)

    expect(result.parsed_items).toBeGreaterThanOrEqual(150)
    expect(result.items_matched / result.parsed_items).toBeGreaterThanOrEqual(0.9)
    expect(result.detection.is_correction_sheet).toBe(true)
  })

  it.skipIf(!pdfPath)('extracts code references present in the PDF', async () => {
    const buffer = fs.readFileSync(pdfPath!)
    const parsed = await parseCorrectionSheetFromPdf(buffer)
    const allRefs = parsed.items.flatMap((i) => i.code_refs)
    expect(allRefs.some((r) => r.includes('LAMC') || r.includes('R3'))).toBe(true)
  })
})

describe('correction sheet text parsing', () => {
  it('parses inline sample text into structured items', () => {
    const sample =
      'PART I. GENERAL REQUIREMENTS A. PERMIT APPLICATION 1. Provide a fully dimensioned plot plan. 2. Provide complete legal description. B. CLEARANCES 1. Obtain all clearances. LAMC 57.09.03'
    const parsed = parseCorrectionListText(sample)
    expect(parsed.items.length).toBeGreaterThanOrEqual(3)
    expect(parsed.items.some((i) => i.id === 'I-A-1')).toBe(true)
    expect(parsed.items.some((i) => i.code_refs.length > 0)).toBe(true)
  })

  it('detects correction sheet markers in sample text', () => {
    const detection = detectCorrectionSheet(
      'PC/STR/Corr.Lst.20A Plan Check Correction Sheet PART I. GENERAL REQUIREMENTS'
    )
    expect(detection.is_correction_sheet).toBe(true)
    expect(detection.list_id).toBe('PC/STR/Corr.Lst.20A')
  })
})
