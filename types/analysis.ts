export type Severity = 'violation' | 'warning' | 'pass'

export type Discipline =
  | 'architectural'
  | 'structural'
  | 'roof'
  | 'electrical'
  | 'plumbing'
  | 'mechanical'
  | 'fire'
  | 'green'
  | 'general'

export interface EntitySheetContext {
  sheet_guid?: string
  sheet_name?: string
  discipline?: Discipline
}

export interface ExtractedWindow extends EntitySheetContext {
  name?: string
  width_in?: number
  height_in?: number
  sill_height_in?: number
  level?: string
  dbId?: number
}

export interface ExtractedDoor extends EntitySheetContext {
  name?: string
  width_in?: number
  height_in?: number
  level?: string
  dbId?: number
}

export interface ExtractedRoom extends EntitySheetContext {
  name: string
  area_sqft?: number
  length_ft?: number
  width_ft?: number
  ceiling_height_ft?: number
  level?: string
  windows?: ExtractedWindow[]
  doors?: ExtractedDoor[]
}

export interface ExtractedStair extends EntitySheetContext {
  name?: string
  riser_height_in?: number
  tread_depth_in?: number
  width_in?: number
  level?: string
  dbId?: number
}

export interface ExtractedGarage extends EntitySheetContext {
  attached?: boolean
  door_count?: number
  fire_separation?: boolean
}

export interface ExtractedLayer {
  name: string
  entity_count: number
}

export interface ExtractedSheet {
  guid: string
  name: string
  discipline: Discipline
  layers: ExtractedLayer[]
  rooms: ExtractedRoom[]
  windows: ExtractedWindow[]
  doors: ExtractedDoor[]
  stairs: ExtractedStair[]
}

export interface ExtractedProperties {
  rooms: ExtractedRoom[]
  windows: ExtractedWindow[]
  doors: ExtractedDoor[]
  stairs: ExtractedStair[]
  garage?: ExtractedGarage
  sheets?: ExtractedSheet[]
  project?: {
    name?: string
    address?: string
    city?: string
    state?: string
    building_type?: string
    total_area_sqft?: number
  }
}

export interface ComplianceViolation {
  severity: Severity
  code_section: string
  code_title: string
  code_requirement: string
  finding: string
  recommendation: string
  element_name?: string
  element_location?: string
  measured_value?: string
  required_value?: string
  confidence?: 'high' | 'medium' | 'low'
  element_id?: string | null
  sheet_guid?: string | null
  discipline?: Discipline | null
}

export interface CodeSectionMatch {
  id: string
  section: string
  title: string
  summary?: string
  full_text: string
  code_body: string
  is_local_amendment?: boolean
  similarity: number
}

export type AnalysisStage =
  | 'translating'
  | 'extracting'
  | 'searching_codes'
  | 'analyzing'
  | 'complete'
  | 'error'

export interface CodeSearchCoverage {
  discipline: Discipline
  sections_retrieved: number
  code_bodies: string[]
  top_sections: Array<{
    section: string
    title: string
    code_body: string
    similarity: number
  }>
}

export interface AnalysisProgressEvent {
  stage: AnalysisStage
  message: string
  analysis_id?: string
  error?: string
  discipline?: Discipline
  sheet_index?: number
  sheet_total?: number
  code_coverage?: CodeSearchCoverage
}

export interface ApsSheetInfo {
  guid: string
  name: string
  role: string
  discipline: Discipline
}
