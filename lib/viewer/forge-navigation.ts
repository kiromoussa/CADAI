/** Forge Viewer v7 navigation helpers (zoom/fit/locate for 2D sheets). */

type Vec3 = { x: number; y: number; z: number }

type ForgeBoundingBox = {
  min: Vec3
  max: Vec3
  center(): Vec3
}

type ForgeModel = {
  getData(): {
    instanceTree: {
      enumNodeFragments(
        dbId: number,
        callback: (fragId: number) => void,
        recursive: boolean
      ): void
    }
  }
  getFragmentList(): {
    getWorldBounds(fragId: number, bounds: ForgeBoundingBox): void
  }
}

export type ForgeViewerLike = {
  navigation: ForgeNavigation
  model: ForgeModel | null
  select: (dbIds: number[]) => void
  fitToView: (dbIds?: number[], model?: ForgeModel, immediate?: boolean) => void
  worldToClient: (point: Vec3) => { x: number; y: number }
  addEventListener: (event: string, callback: () => void) => void
  removeEventListener: (event: string, callback: () => void) => void
  setNavigationLock?: (lock: boolean) => void
  impl?: { invalidate?: (a: boolean, b: boolean, c: boolean) => void }
}

type ForgeNavigation = {
  dollyFromPoint?: (distance: number, point: Vec3) => void
  fitBounds?: (immediate: boolean, bounds: ForgeBox3) => void
  setRequestHomeView?: (flag: boolean) => void
  setZoomTowardsPivot?: (state: boolean) => void
  setReverseZoomDirection?: (state: boolean) => void
  setConstraints2D?: () => void
  getPivotPoint?: () => Vec3
  getPosition?: () => Vec3
  getTarget?: () => Vec3
  FIT_TO_VIEW_VERTICAL_MARGIN?: number
  FIT_TO_VIEW_HORIZONTAL_MARGIN?: number
}

type ForgeBox3 = {
  min: Vec3
  max: Vec3
  isEmpty(): boolean
  union(box: ForgeBox3): ForgeBox3
  expandByPoint(point: Vec3): ForgeBox3
  getCenter(target: Vec3): Vec3
}

function getThree(): {
  Vector3: new (x?: number, y?: number, z?: number) => Vec3 & { length(): number }
  Box3: new () => ForgeBox3
} | undefined {
  return (window as Window & { THREE?: typeof THREE }).THREE as
    | {
        Vector3: new (x?: number, y?: number, z?: number) => Vec3 & { length(): number }
        Box3: new () => ForgeBox3
      }
    | undefined
}

function getBoundingBoxCtor():
  | (new () => ForgeBoundingBox)
  | undefined {
  const win = window as Window & {
    Autodesk?: { Viewing?: { BoundingBox?: new () => ForgeBoundingBox } }
  }
  return win.Autodesk?.Viewing?.BoundingBox
}

function getPivot(viewer: ForgeViewerLike): Vec3 {
  const nav = viewer.navigation
  if (typeof nav.getPivotPoint === 'function') return nav.getPivotPoint()
  if (typeof nav.getTarget === 'function') return nav.getTarget()
  if (typeof nav.getPosition === 'function') return nav.getPosition()
  return { x: 0, y: 0, z: 0 }
}

export function configure2DNavigation(viewer: ForgeViewerLike) {
  const nav = viewer.navigation
  nav.setZoomTowardsPivot?.(true)
  nav.setReverseZoomDirection?.(false)
  nav.setConstraints2D?.()
  viewer.setNavigationLock?.(false)
}

export function zoomViewer(viewer: ForgeViewerLike, direction: 'in' | 'out') {
  const THREE = getThree()
  const nav = viewer.navigation
  if (!THREE || typeof nav.dollyFromPoint !== 'function') return

  const pivot = getPivot(viewer)
  const position =
    typeof nav.getPosition === 'function' ? nav.getPosition() : pivot
  const offset = new THREE.Vector3(
    position.x - pivot.x,
    position.y - pivot.y,
    position.z - pivot.z
  )
  const length = offset.length()
  if (length < 1e-6) return

  const step = length * 0.22 * (direction === 'in' ? -1 : 1)
  nav.dollyFromPoint(step, pivot)
  viewer.impl?.invalidate?.(true, true, true)
}

export function fitViewerHome(viewer: ForgeViewerLike) {
  const nav = viewer.navigation
  if (typeof nav.setRequestHomeView === 'function') {
    nav.setRequestHomeView(true)
    return
  }
  viewer.fitToView(undefined, viewer.model ?? undefined, false)
}

export function fitViewerToModel(viewer: ForgeViewerLike, animate = false) {
  viewer.fitToView(undefined, viewer.model ?? undefined, !animate)
}

export function getDbIdBounds(
  viewer: ForgeViewerLike,
  dbId: number
): ForgeBox3 | null {
  const THREE = getThree()
  const BoundingBox = getBoundingBoxCtor()
  const model = viewer.model
  if (!THREE || !BoundingBox || !model) return null

  const union = new THREE.Box3()
  let hasFragment = false
  const fragBox = new BoundingBox()

  try {
    model.getData().instanceTree.enumNodeFragments(
      dbId,
      (fragId: number) => {
        model.getFragmentList().getWorldBounds(fragId, fragBox)
        union.expandByPoint(fragBox.min)
        union.expandByPoint(fragBox.max)
        hasFragment = true
      },
      true
    )
  } catch {
    return null
  }

  if (!hasFragment || union.isEmpty()) return null
  return union
}

export function safeSelectDbIds(
  viewer: ForgeViewerLike,
  dbIds: number[]
): boolean {
  const validIds = dbIds.filter((id) => !Number.isNaN(id))
  if (validIds.length === 0 || !viewer.model) return false
  try {
    viewer.select(validIds)
    return true
  } catch {
    // 2D sheets may not have a selection manager until geometry is fully loaded.
    return false
  }
}

export function locateDbIds(
  viewer: ForgeViewerLike,
  dbIds: number[],
  options?: { animate?: boolean }
): boolean {
  const animate = options?.animate ?? true
  const nav = viewer.navigation

  const validIds = dbIds.filter((id) => !Number.isNaN(id))
  if (validIds.length === 0) return false

  safeSelectDbIds(viewer, validIds)

  const THREE = getThree()
  if (!THREE) {
    viewer.fitToView(validIds, viewer.model ?? undefined, !animate)
    return true
  }

  const union = new THREE.Box3()
  let hasBounds = false
  for (const dbId of validIds) {
    const box = getDbIdBounds(viewer, dbId)
    if (!box) continue
    union.union(box)
    hasBounds = true
  }

  if (hasBounds && typeof nav.fitBounds === 'function') {
    nav.FIT_TO_VIEW_VERTICAL_MARGIN = 0.12
    nav.FIT_TO_VIEW_HORIZONTAL_MARGIN = 0.12
    nav.fitBounds(!animate, union)
    return true
  }

  viewer.fitToView(validIds, viewer.model ?? undefined, !animate)
  return true
}

export function waitForViewerModel(
  viewer: ForgeViewerLike,
  timeoutMs = 8000
): Promise<void> {
  if (viewer.model) return Promise.resolve()

  return new Promise((resolve) => {
    const win = window as Window & {
      Autodesk?: { Viewing?: { GEOMETRY_LOADED_EVENT: string } }
    }
    const eventName = win.Autodesk?.Viewing?.GEOMETRY_LOADED_EVENT
    if (!eventName) {
      resolve()
      return
    }

    const started = Date.now()
    const onLoaded = () => {
      viewer.removeEventListener(eventName, onLoaded)
      resolve()
    }
    viewer.addEventListener(eventName, onLoaded)

    const poll = () => {
      if (viewer.model || Date.now() - started >= timeoutMs) {
        viewer.removeEventListener(eventName, onLoaded)
        resolve()
        return
      }
      requestAnimationFrame(poll)
    }
    requestAnimationFrame(poll)
  })
}

export function getDbIdScreenCenter(
  viewer: ForgeViewerLike,
  dbId: number
): { x: number; y: number } | null {
  const THREE = getThree()
  const bounds = getDbIdBounds(viewer, dbId)
  if (!bounds || !THREE) return null
  const center = bounds.getCenter(new THREE.Vector3())
  return viewer.worldToClient(center)
}

declare namespace THREE {
  class Vector3 {
    constructor(x?: number, y?: number, z?: number)
    x: number
    y: number
    z: number
    length(): number
  }
  class Box3 {
    constructor()
    min: Vector3
    max: Vector3
    isEmpty(): boolean
    union(box: Box3): Box3
    expandByPoint(point: Vector3): Box3
    getCenter(target: Vector3): Vector3
  }
}
