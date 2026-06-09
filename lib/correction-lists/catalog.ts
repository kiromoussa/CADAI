import catalogJson from '@/lib/correction-lists/data/pc-str-corr-lst-20a.json'
import type { CorrectionListCatalog } from '@/lib/correction-lists/types'

export const PC_STR_CORR_LST_20A = catalogJson as CorrectionListCatalog

export const CORRECTION_LIST_IDS = {
  PC_STR_CORR_LST_20A: 'PC/STR/Corr.Lst.20A',
} as const

export function getCorrectionListById(listId: string): CorrectionListCatalog | null {
  if (listId === CORRECTION_LIST_IDS.PC_STR_CORR_LST_20A) {
    return PC_STR_CORR_LST_20A
  }
  return null
}

export function allCatalogCodeRefs(list: CorrectionListCatalog): string[] {
  return list.unique_code_refs
}
