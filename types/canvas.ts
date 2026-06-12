import type { Json } from '@/types/database'

export interface CanvasViewport {
  scrollX: number
  scrollY: number
  zoom: number
}

/** Minimal Excalidraw API surface used by the board page (avoids bundling @excalidraw). */
export interface ExcalidrawBoardApi {
  getSceneElements: () => readonly unknown[]
  getAppState: () => Record<string, unknown>
  getFiles: () => Record<string, unknown>
  updateScene: (scene: { elements?: readonly unknown[] | null }) => void
}

export type CanvasNodeType = 'pdf' | 'forge' | 'code_ingest' | 'group' | 'note'

export type CodeIngestStatus = 'queued' | 'processing' | 'complete' | 'error'

export interface ExcalidrawScene {
  elements: ExcalidrawElement[]
  appState?: Record<string, unknown>
  files?: Record<string, unknown>
  /** Shapes available in the Excalidraw library picker (persisted with the board). */
  libraryItems?: readonly unknown[]
}

export interface ExcalidrawElement {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  angle?: number
  strokeColor?: string
  backgroundColor?: string
  fillStyle?: string
  strokeWidth?: number
  roughness?: number
  opacity?: number
  groupIds?: string[]
  frameId?: string | null
  roundness?: { type: number } | null
  seed?: number
  version?: number
  versionNonce?: number
  isDeleted?: boolean
  boundElements?: Array<{ id: string; type: string }> | null
  updated?: number
  link?: string | null
  locked?: boolean
  customData?: Record<string, unknown>
  [key: string]: unknown
}

export interface CanvasBoardRow {
  id: string
  user_id: string
  project_id: string | null
  title: string
  default_city: string | null
  default_state: string | null
  default_project_type: string | null
  scene_json: Json
  thumbnail_path: string | null
  created_at: string
  updated_at: string
}

export interface CanvasNodeRow {
  id: string
  board_id: string
  excalidraw_element_id: string
  node_type: CanvasNodeType
  x: number
  y: number
  width: number
  height: number
  project_id: string | null
  storage_path: string | null
  aps_urn: string | null
  analysis_id: string | null
  content: Json
  created_at: string
  updated_at: string
}

export interface CodeIngestJobRow {
  id: string
  user_id: string
  board_id: string | null
  node_id: string | null
  status: CodeIngestStatus
  storage_path: string
  jurisdiction: string | null
  city: string | null
  state: string | null
  code_year: number | null
  sections_count: number
  error: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface AnalysisAnnotationRow {
  id: string
  analysis_id: string
  user_id: string
  sheet_guid: string | null
  scene_json: Json
  created_at: string
  updated_at: string
}

export interface CanvasNodeContent {
  label?: string
  file_name?: string
  analysis_status?: string
  upload_status?: 'uploading' | 'translating' | 'error'
  violation_count?: number
  warning_count?: number
  // 'plan' = building-plan PDF (runs code compliance), 'document' = a normal
  // reference PDF that is not analyzed.
  doc_kind?: 'plan' | 'document'
}
