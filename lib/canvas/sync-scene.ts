import type { CanvasNodeRow } from '@/types/database'
import type { ExcalidrawElement, ExcalidrawScene } from '@/types/canvas'

function createPlanFrameElement(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string | undefined,
  nodeType: 'pdf' | 'forge',
  strokeColor: string
): ExcalidrawElement {
  return {
    id,
    type: 'rectangle',
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor,
    backgroundColor: '#111827',
    fillStyle: 'solid',
    strokeWidth: 2,
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: { type: 3 },
    seed: Math.floor(Math.random() * 1_000_000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 1_000_000),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    customData: {
      nodeType,
      label: label ?? (nodeType === 'pdf' ? 'Floor plan' : 'CAD model'),
    },
  }
}

export function createPdfFrameElement(
  id: string,
  x: number,
  y: number,
  width = 480,
  height = 360,
  label?: string
): ExcalidrawElement {
  return createPlanFrameElement(id, x, y, width, height, label, 'pdf', '#3B82F6')
}

export function createForgeFrameElement(
  id: string,
  x: number,
  y: number,
  width = 480,
  height = 360,
  label?: string
): ExcalidrawElement {
  return createPlanFrameElement(id, x, y, width, height, label, 'forge', '#F59E0B')
}

/** A plain reference PDF (not a building plan): rendered with the PDF node but
 *  styled green so it is visually distinct from analyzable floor-plan PDFs. */
export function createDocumentFrameElement(
  id: string,
  x: number,
  y: number,
  width = 420,
  height = 320,
  label?: string
): ExcalidrawElement {
  return createPlanFrameElement(id, x, y, width, height, label, 'pdf', '#10B981')
}

export function syncNodesFromScene(
  scene: ExcalidrawScene,
  nodes: CanvasNodeRow[]
): Array<Partial<CanvasNodeRow> & { id: string }> {
  const updates: Array<Partial<CanvasNodeRow> & { id: string }> = []

  for (const node of nodes) {
    const el = scene.elements.find(
      (e) => e.id === node.excalidraw_element_id && !e.isDeleted
    )
    if (!el) continue
    if (
      el.x !== node.x ||
      el.y !== node.y ||
      el.width !== node.width ||
      el.height !== node.height
    ) {
      updates.push({
        id: node.id,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
      })
    }
  }

  return updates
}

/**
 * Remove every Excalidraw element that represents a node "frame" (PDF / Forge /
 * document). These are rendered instead by the interactive overlay windows,
 * which keep a constant pixel size; leaving the Excalidraw rectangle in the
 * scene makes a duplicate that rescales with canvas zoom. Frames are detected by
 * their `customData.nodeType` marker, with a fallback to known node element ids.
 */
export function stripNodeFrameElements(
  scene: ExcalidrawScene,
  nodeElementIds: Set<string>
): ExcalidrawScene {
  return {
    ...scene,
    elements: scene.elements.filter((el) => {
      const customData = (el as { customData?: { nodeType?: unknown } }).customData
      if (customData && customData.nodeType) return false
      const id = (el as { id?: string }).id ?? ''
      return !nodeElementIds.has(id)
    }),
  }
}

export function mergeSceneElements(
  scene: ExcalidrawScene,
  newElements: ExcalidrawElement[]
): ExcalidrawScene {
  const byId = new Map(scene.elements.map((e) => [e.id, e]))
  for (const el of newElements) {
    byId.set(el.id, el)
  }
  return {
    ...scene,
    elements: Array.from(byId.values()),
  }
}

/** Excalidraw runtime fields (Map/Set/handles) that break after JSON storage. */
const NON_PERSISTED_APP_STATE_KEYS = [
  'collaborators',
  'followedBy',
  'fileHandle',
  'editingLinearElement',
  'editingTextElement',
  'selectedLinearElement',
] as const

export function sanitizeAppState(
  appState: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!appState || typeof appState !== 'object') return {}
  const next = { ...appState }
  for (const key of NON_PERSISTED_APP_STATE_KEYS) {
    delete next[key]
  }
  return next
}

/** Cheap fingerprint to skip redundant React state updates from Excalidraw onChange. */
export function sceneChangeSignature(scene: ExcalidrawScene): string {
  const elements = scene.elements
    .map((el) => `${el.id}:${el.version ?? 0}`)
    .join(',')
  const app = scene.appState ?? {}
  const zoom =
    typeof app.zoom === 'object' && app.zoom !== null && 'value' in app.zoom
      ? String((app.zoom as { value?: number }).value ?? 1)
      : '1'
  const scroll = `${app.scrollX ?? 0},${app.scrollY ?? 0},${zoom}`
  const fileCount = scene.files ? Object.keys(scene.files).length : 0
  const libCount = scene.libraryItems?.length ?? 0
  return `${elements}|${scroll}|f${fileCount}|l${libCount}`
}

export function parseSceneJson(raw: unknown): ExcalidrawScene {
  if (!raw || typeof raw !== 'object') {
    return { elements: [], appState: {}, files: {} }
  }
  const obj = raw as ExcalidrawScene
  return {
    elements: Array.isArray(obj.elements) ? obj.elements : [],
    appState: sanitizeAppState(obj.appState as Record<string, unknown> | undefined),
    files: obj.files ?? {},
    libraryItems: Array.isArray(obj.libraryItems) ? obj.libraryItems : undefined,
  }
}
