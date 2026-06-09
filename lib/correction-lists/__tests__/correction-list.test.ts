import { describe, expect, it } from 'vitest'
import { PC_STR_CORR_LST_20A } from '@/lib/correction-lists/catalog'
import {
  appliesLaAduCorrectionList,
  buildCorrectionListSearchQuery,
  correctionListItemsForDiscipline,
  getPinnedCorrectionListSections,
} from '@/lib/correction-lists/analysis-seed'
import { collapseSectionDigits, normalizeCodeRef, normalizeCodeRefs } from '@/lib/correction-lists/code-refs'
import { lookupCodeRef } from '@/lib/correction-lists/lookup'
import { resolveSectionAlias } from '@/lib/correction-lists/section-aliases'
import { verifyCatalogCodeCoverage } from '@/lib/correction-lists/verify'

describe('PC.STR.Corr.Lst.20A checklist (reference catalog, not user upload)', () => {
  it('loads the full LA ADU plan check checklist', () => {
    expect(PC_STR_CORR_LST_20A.list_id).toBe('PC/STR/Corr.Lst.20A')
    expect(PC_STR_CORR_LST_20A.parts).toHaveLength(3)
    expect(PC_STR_CORR_LST_20A.total_items).toBeGreaterThanOrEqual(150)
    expect(PC_STR_CORR_LST_20A.forms).toContain('PC/STR/Aff.45')
  })

  it('applies to Los Angeles ADU plan/DWG analysis only', () => {
    expect(appliesLaAduCorrectionList('Los Angeles', 'CA', 'adu')).toBe(true)
    expect(appliesLaAduCorrectionList('Santa Ana', 'CA', 'adu')).toBe(false)
    expect(appliesLaAduCorrectionList('Los Angeles', 'CA', 'commercial')).toBe(false)
  })

  it('maps 2023 LARC section numbers to 2025 CRC equivalents', () => {
    expect(resolveSectionAlias('R311.7.5')).toContain('R318.7.5')
    expect(resolveSectionAlias('R310.1')).toContain('R319.1')
  })

  it('resolves checklist code refs against ingested code chunks', () => {
    const residential = lookupCodeRef(normalizeCodeRef('R302.6')!)
    const stairs = lookupCodeRef(normalizeCodeRef('R311.7.5')!)
    const eero = lookupCodeRef(normalizeCodeRef('R310.1')!)
    const building = lookupCodeRef(normalizeCodeRef('406.3.2')!)

    expect(residential.found).toBe(true)
    expect(stairs.found).toBe(true)
    expect(stairs.ref.section).toBe('R318.7.5')
    expect(eero.found).toBe(true)
    expect(eero.ref.section).toBe('R319.1')
    expect(building.found).toBe(true)
  })

  it('marks LA municipal zoning refs as local-only (not in CA state chunks)', () => {
    const lamc = lookupCodeRef(normalizeCodeRef('LAMC 57.09.03')!)
    expect(lamc.found).toBe(true)
    expect(lamc.source).toBe('local_only')
  })

  it('verifies indexable checklist codes exist without any PDF upload', () => {
    const result = verifyCatalogCodeCoverage()
    expect(result.catalog_items).toBe(PC_STR_CORR_LST_20A.total_items)
    expect(result.code_refs_total).toBeGreaterThan(50)
    expect(result.coverage_percent).toBeGreaterThanOrEqual(80)
  })

  it('deduplicates compound code references from checklist items', () => {
    const refs = normalizeCodeRefs(['406.3.2, R302.6', 'R302.6'])
    expect(refs).toHaveLength(2)
  })

  it('normalizes OCR-spaced government code references', () => {
    const ref = normalizeCodeRef('GC § 6 6323(a)(2)')
    expect(ref?.family).toBe('government')
    expect(ref?.section).toContain('66323')
  })
})

describe('plan/DWG analysis integration with checklist', () => {
  it('seeds architectural discipline with checklist topics for LA ADU', () => {
    const items = correctionListItemsForDiscipline('architectural')
    expect(items.length).toBeGreaterThan(30)
    const query = buildCorrectionListSearchQuery('architectural', {
      city: 'Los Angeles',
      state: 'CA',
      project_type: 'adu',
    })
    expect(query).toContain('PC/STR/Corr.Lst.20A')
    expect(query.toLowerCase()).toMatch(/egress|adu|setback|garage/)
  })

  it('pins key checklist sections for LA ADU architectural analysis', () => {
    const pinned = getPinnedCorrectionListSections('architectural')
    const sections = pinned.map((p) => p.section)
    expect(sections).toContain('R302.6')
    expect(sections.some((s) => s.startsWith('R318') || s.startsWith('R319'))).toBe(true)
    expect(pinned.every((p) => p.similarity === 1)).toBe(true)
  })

  it('pins fire and structural checklist sections for LA ADU', () => {
    const firePinned = getPinnedCorrectionListSections('fire')
    const structuralPinned = getPinnedCorrectionListSections('structural')
    expect(firePinned.length).toBeGreaterThan(0)
    expect(structuralPinned.length).toBeGreaterThan(0)
  })

  it('does not apply checklist seeding outside Los Angeles ADU projects', () => {
    expect(
      buildCorrectionListSearchQuery('architectural', {
        city: 'Los Angeles',
        state: 'CA',
        project_type: 'adu',
      }).length
    ).toBeGreaterThan(100)
    expect(
      appliesLaAduCorrectionList('Irvine', 'CA', 'adu')
    ).toBe(false)
  })
})
