import { PC_STR_CORR_LST_20A } from '@/lib/correction-lists/catalog'
import { isLocalOnlyRef, normalizeCodeRefs } from '@/lib/correction-lists/code-refs'
import { lookupCodeRef } from '@/lib/correction-lists/lookup'
import type { CorrectionListItem } from '@/lib/correction-lists/types'
import type { CodeSectionMatch, Discipline } from '@/types/analysis'
import { disciplineLabel } from '@/lib/analysis/disciplines'

const LA_ADU_PROJECT_TYPES = new Set(['adu', 'junior adu', 'jadu', 'mth', 'accessory dwelling unit'])

const PART_DISCIPLINE: Record<string, Discipline[]> = {
  I: ['general', 'architectural'],
  II: ['architectural', 'general'],
  III: ['architectural', 'structural', 'fire', 'electrical', 'plumbing', 'mechanical', 'green', 'roof'],
}

const SECTION_KEYWORDS: Array<{ pattern: RegExp; disciplines: Discipline[] }> = [
  { pattern: /garage|occupancy|U occupancy|406/i, disciplines: ['architectural', 'fire'] },
  { pattern: /stair|egress|handrail|guard|landing|ramp|exit/i, disciplines: ['architectural', 'fire'] },
  { pattern: /smoke|carbon monoxide|sprinkler|fire alarm|907|915/i, disciplines: ['fire', 'electrical'] },
  { pattern: /foundation|footing|shear|structural|WFPP|2308|1808/i, disciplines: ['structural'] },
  { pattern: /roof|drain|cool roof|1505|903/i, disciplines: ['roof', 'architectural'] },
  { pattern: /energy|Title 24|HERS|CALGreen|green/i, disciplines: ['green', 'mechanical'] },
  { pattern: /plumb|water closet|shower|lavatory|LAPC/i, disciplines: ['plumbing'] },
  { pattern: /electrical|wiring|panel/i, disciplines: ['electrical'] },
  { pattern: /glazing|tempered|window|skylight|2406|R308/i, disciplines: ['architectural'] },
  { pattern: /ADU|JADU|MTH|setback|zoning|LAMC|parking|RFA|floor area/i, disciplines: ['architectural', 'general'] },
]

function isLosAngeles(city: string, state: string): boolean {
  const c = city.trim().toLowerCase()
  const s = state.trim().toLowerCase()
  return (s === 'ca' || s === 'california') && (c.includes('los angeles') || c === 'la')
}

function isAduProject(projectType: string): boolean {
  const p = projectType.trim().toLowerCase()
  return LA_ADU_PROJECT_TYPES.has(p) || p.includes('adu') || p.includes('accessory')
}

/** LA ADU plan check uses PC.STR.Corr.Lst.20A as the review checklist. */
export function appliesLaAduCorrectionList(city: string, state: string, projectType: string): boolean {
  return isLosAngeles(city, state) && isAduProject(projectType)
}

export function inferItemDisciplines(item: CorrectionListItem): Discipline[] {
  const fromPart = PART_DISCIPLINE[item.part] ?? ['general']
  const fromText = new Set<Discipline>()

  for (const { pattern, disciplines } of SECTION_KEYWORDS) {
    if (pattern.test(item.text) || pattern.test(item.section_title)) {
      for (const d of disciplines) fromText.add(d)
    }
  }

  if (fromText.size === 0) return fromPart
  return Array.from(fromText)
}

export function correctionListItemsForDiscipline(discipline: Discipline): CorrectionListItem[] {
  return PC_STR_CORR_LST_20A.items.filter((item) =>
    inferItemDisciplines(item).includes(discipline)
  )
}

/** Semantic search boost queries derived from the city plan-check checklist (not from user uploads). */
export function buildCorrectionListSearchQuery(
  discipline: Discipline,
  context: { city: string; state: string; project_type: string }
): string {
  const items = correctionListItemsForDiscipline(discipline).slice(0, 25)
  const topics = items.map((item) => item.text.slice(0, 160))
  const codeHints = Array.from(
    new Set(items.flatMap((item) => item.code_refs).slice(0, 20))
  )

  return [
    `Los Angeles ADU JADU MTH plan check ${disciplineLabel(discipline)}`,
    `PC/STR/Corr.Lst.20A checklist ${context.project_type} ${context.city}`,
    ...topics,
    ...codeHints,
  ].join('\n')
}

/** Direct section pins so plan/DWG analysis always retrieves checklist code sections. */
export function getPinnedCorrectionListSections(discipline: Discipline): CodeSectionMatch[] {
  const items = correctionListItemsForDiscipline(discipline)
  const refs = normalizeCodeRefs(items.flatMap((item) => item.code_refs)).filter(
    (ref) => !isLocalOnlyRef(ref)
  )

  const seen = new Set<string>()
  const pinned: CodeSectionMatch[] = []

  for (const ref of refs) {
    const lookup = lookupCodeRef(ref)
    if (!lookup.found || lookup.source !== 'chunk') continue

    const key = `${ref.code_body ?? ref.family}:${lookup.ref.section}`
    if (seen.has(key)) continue
    seen.add(key)

    const resolvedSection = lookup.ref.section
    pinned.push({
      id: `correction-list:${resolvedSection}`,
      section: resolvedSection,
      title: lookup.title ?? `Section ${resolvedSection}`,
      full_text:
        lookup.title ??
        `Section ${resolvedSection} (from LA ADU plan check checklist)`,
      code_body: ref.code_body ?? 'California Residential Code',
      similarity: 1,
    })
  }

  return pinned
}

export function getCorrectionListChecklistSummary(): {
  list_id: string
  total_items: number
  indexable_code_refs: number
} {
  const refs = normalizeCodeRefs(
    PC_STR_CORR_LST_20A.items.flatMap((item) => item.code_refs)
  ).filter((ref) => !isLocalOnlyRef(ref))

  return {
    list_id: PC_STR_CORR_LST_20A.list_id,
    total_items: PC_STR_CORR_LST_20A.total_items,
    indexable_code_refs: refs.length,
  }
}
