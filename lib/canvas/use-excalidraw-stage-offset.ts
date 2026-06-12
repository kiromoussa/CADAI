'use client'

import { useEffect, useState } from 'react'
import type { StageOffset } from '@/lib/canvas/overlay-geometry'

/**
 * Excalidraw draws the infinite canvas inside `.excalidraw-wrapper`, inset from
 * the board host by toolbars. Node overlays must use the same origin or they
 * drift (and appear to rescale) when zooming.
 */
export function useExcalidrawStageOffset(
  containerRef: React.RefObject<HTMLElement | null>
): StageOffset {
  const [offset, setOffset] = useState<StageOffset>({ left: 0, top: 0 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const measure = () => {
      const host = container.querySelector('.excalidraw-board-host')
      const stage =
        host?.querySelector('.excalidraw-wrapper') ??
        host?.querySelector('.excalidraw')
      if (!stage) return

      const containerRect = container.getBoundingClientRect()
      const stageRect = stage.getBoundingClientRect()
      const left = stageRect.left - containerRect.left
      const top = stageRect.top - containerRect.top
      setOffset((prev) =>
        prev.left === left && prev.top === top ? prev : { left, top }
      )
    }

    measure()

    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(container)

    const host = container.querySelector('.excalidraw-board-host')
    const mutationObserver = new MutationObserver(measure)
    if (host) {
      mutationObserver.observe(host, { childList: true, subtree: true })
      resizeObserver.observe(host)
    }

    window.addEventListener('resize', measure)

    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [containerRef])

  return offset
}
