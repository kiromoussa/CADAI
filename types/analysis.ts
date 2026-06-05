export type Severity = 'violation' | 'warning' | 'pass'

export interface ExtractedWindow {
  name?: string
  width_in?: number
  height_in?: number
  sill_height_in?: number
  level?: string
  dbId?: number
}

export interface ExtractedDoor {
  name?: string
  width_in?: number
  height_in?: number
  level?: string
  dbId?: number
}

export interface ExtractedRoom {
  name: string
  area_sqft?: number
  length_ft?: number
  width_ft?: number
  ceiling_height_ft?: number
  level?: string
  windows?: ExtractedWindow[]
  doors?: ExtractedDoor[]
}

export interface ExtractedStair {
  name?: string
  riser_height_in?: number
  tread_depth_in?: number
  width_in?: number
  level?: string
  dbId?: number
}

export interface ExtractedGarage {
  attached?: boolean
  door_count?: number
  fire_separation?: boolean
}

export interface ExtractedProperties {
  rooms: ExtractedRoom[]
  windows: ExtractedWindow[]
  doors: ExtractedDoor[]
  stairs: ExtractedStair[]
  garage?: ExtractedGarage
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

export interface AnalysisProgressEvent {
  stage: AnalysisStage
  message: string
  analysis_id?: string
  error?: string
}
