import type { ExcalidrawElement } from '@/types/canvas'

export interface ViewportTransform {
  scrollX: number
  scrollY: number
  zoom: number
}

export interface ScreenRect {
  left: number
  top: number
  width: number
  height: number
}

/** Map Excalidraw scene coords to screen pixels inside the canvas container. */
export function sceneToScreen(
  element: Pick<ExcalidrawElement, 'x' | 'y' | 'width' | 'height'>,
  viewport: ViewportTransform,
  containerRect: DOMRect
): ScreenRect {
  const zoom = viewport.zoom || 1
  const left = (element.x + viewport.scrollX) * zoom
  const top = (element.y + viewport.scrollY) * zoom
  return {
    left: left + containerRect.left,
    top: top + containerRect.top,
    width: element.width * zoom,
    height: element.height * zoom,
  }
}

export function findElementById(
  elements: ExcalidrawElement[],
  id: string
): ExcalidrawElement | undefined {
  return elements.find((el) => el.id === id && !el.isDeleted)
}
