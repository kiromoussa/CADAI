export interface CorrectionListPart {
  part: string
  title: string
}

export interface CorrectionListItem {
  id: string
  part: string
  section: string
  section_title: string
  number: number
  text: string
  code_refs: string[]
}

export interface CorrectionListCatalog {
  list_id: string
  revision: string
  title: string
  jurisdiction: string
  code_year: number
  forms: string[]
  information_bulletins: string[]
  parts: CorrectionListPart[]
  items: CorrectionListItem[]
  total_items: number
  unique_code_refs: string[]
}

export type CodeRefFamily =
  | 'residential'
  | 'building'
  | 'electrical'
  | 'mechanical'
  | 'plumbing'
  | 'fire'
  | 'green'
  | 'lamc'
  | 'labc'
  | 'larc'
  | 'lapc'
  | 'government'
  | 'ordinance'
  | 'other'

export interface NormalizedCodeRef {
  raw: string
  family: CodeRefFamily
  section: string
  code_body: string | null
}

export interface CodeRefLookupResult {
  ref: NormalizedCodeRef
  found: boolean
  source: 'chunk' | 'catalog' | 'local_only' | 'not_indexed'
  title?: string
  chunk_file?: string
}

export interface CorrectionListVerification {
  list_id: string
  revision: string
  detected_from_upload: boolean
  catalog_items: number
  parsed_items: number
  items_matched: number
  items_missing: string[]
  forms_expected: string[]
  forms_found: string[]
  bulletins_expected: string[]
  code_refs_total: number
  code_refs_found: number
  code_refs_missing: NormalizedCodeRef[]
  code_ref_details: CodeRefLookupResult[]
  coverage_percent: number
}
