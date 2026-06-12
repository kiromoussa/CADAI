import type { CanvasViewport } from '@/types/canvas'

export interface StageOffset {
  left: number
  top: number
}

export interface OverlayRect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Map stored scene-space node geometry to overlay pixels. Node windows behave
 * like native Excalidraw elements: position and size both scale with zoom.
 */
export function sceneNodeToOverlayRect(
  node: { x: number; y: number; width: number; height: number },
  viewport: CanvasViewport,
  stageOffset: StageOffset
): OverlayRect {
  const zoom = viewport.zoom || 1
  return {
    left: (node.x + viewport.scrollX) * zoom + stageOffset.left,
    top: (node.y + viewport.scrollY) * zoom + stageOffset.top,
    width: node.width * zoom,
    height: node.height * zoom,
  }
}

/** Convert overlay pixel rect back to scene-space node geometry after drag/resize. */
export function overlayRectToSceneNode(
  rect: OverlayRect,
  viewport: CanvasViewport,
  stageOffset: StageOffset
): { x: number; y: number; width: number; height: number } {
  const zoom = viewport.zoom || 1
  return {
    x: (rect.left - stageOffset.left) / zoom - viewport.scrollX,
    y: (rect.top - stageOffset.top) / zoom - viewport.scrollY,
    width: rect.width / zoom,
    height: rect.height / zoom,
  }
}
