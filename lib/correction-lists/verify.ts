import {
  CORRECTION_LIST_IDS,
  getCorrectionListById,
  PC_STR_CORR_LST_20A,
} from '@/lib/correction-lists/catalog'
import { isLocalOnlyRef, normalizeCodeRefs } from '@/lib/correction-lists/code-refs'
import { detectCorrectionSheet } from '@/lib/correction-lists/detect'
import { lookupCodeRef } from '@/lib/correction-lists/lookup'
import { matchParsedToCatalog, parseCorrectionListText } from '@/lib/correction-lists/parse'
import type {
  CorrectionListCatalog,
  CorrectionListVerification,
  NormalizedCodeRef,
} from '@/lib/correction-lists/types'

export function verifyCatalogCodeCoverage(
  catalog: CorrectionListCatalog = PC_STR_CORR_LST_20A
): CorrectionListVerification {
  const allRefs = catalog.items.flatMap((item) => item.code_refs)
  const normalized = normalizeCodeRefs(allRefs)
  const code_ref_details = normalized.map((ref) => lookupCodeRef(ref))

  const indexable = code_ref_details.filter((r) => !isLocalOnlyRef(r.ref))
  const code_refs_found = code_ref_details.filter((r) => r.found).length
  const code_refs_missing = code_ref_details
    .filter((r) => !r.found && !isLocalOnlyRef(r.ref))
    .map((r) => r.ref)

  const indexableFound = indexable.filter((r) => r.found).length
  const coverage_percent =
    indexable.length === 0 ? 100 : Math.round((indexableFound / indexable.length) * 100)

  return {
    list_id: catalog.list_id,
    revision: catalog.revision,
    detected_from_upload: false,
    catalog_items: catalog.total_items,
    parsed_items: catalog.total_items,
    items_matched: catalog.total_items,
    items_missing: [],
    forms_expected: catalog.forms,
    forms_found: catalog.forms,
    bulletins_expected: catalog.information_bulletins,
    code_refs_total: normalized.length,
    code_refs_found,
    code_refs_missing,
    code_ref_details,
    coverage_percent,
  }
}

export function verifyUploadedCorrectionSheet(
  text: string,
  listId?: string | null
): CorrectionListVerification & {
  parsed: CorrectionListCatalog
  detection: ReturnType<typeof detectCorrectionSheet>
} {
  const detection = detectCorrectionSheet(text)
  const parsed = parseCorrectionListText(text)
  const catalogId =
    listId ?? detection.list_id ?? CORRECTION_LIST_IDS.PC_STR_CORR_LST_20A
  const catalog = getCorrectionListById(catalogId) ?? PC_STR_CORR_LST_20A

  const { matched, missing } = matchParsedToCatalog(parsed, catalog)
  const base = verifyCatalogCodeCoverage(catalog)

  const forms_found = catalog.forms.filter((form) => text.includes(form.replace(/\./g, '.')))

  return {
    ...base,
    detected_from_upload: detection.is_correction_sheet,
    parsed_items: parsed.total_items,
    items_matched: matched,
    items_missing: missing,
    forms_found,
    parsed,
    detection,
  }
}

export function summarizeVerification(
  result: CorrectionListVerification
): { ok: boolean; message: string } {
  const itemsOk = result.items_missing.length === 0
  const codesOk = result.code_refs_missing.length === 0
  const ok = itemsOk && result.coverage_percent >= 80

  const message = [
    `Correction list ${result.list_id} (${result.revision})`,
    `${result.items_matched}/${result.parsed_items} items matched catalog`,
    `${result.code_refs_found}/${result.code_refs_total} code references resolved`,
    `${result.coverage_percent}% indexed code coverage`,
    itemsOk ? 'All catalog items present in upload' : `Missing items: ${result.items_missing.slice(0, 5).join(', ')}`,
    codesOk ? 'All indexable code refs found' : `${result.code_refs_missing.length} code refs not in local index`,
  ].join(' · ')

  return { ok, message }
}

export type { NormalizedCodeRef }
