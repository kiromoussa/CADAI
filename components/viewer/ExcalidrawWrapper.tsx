'use client'

import dynamic from 'next/dynamic'
import type { ExcalidrawScene } from '@/types/canvas'

const ExcalidrawCanvas = dynamic(
  () =>
    import('@/components/canvas/ExcalidrawCanvas').then((m) => ({
      default: m.ExcalidrawCanvas,
    })),
  { ssr: false }
)

interface ExcalidrawWrapperProps {
  scene: ExcalidrawScene
  onElementClick?: (violationId: string) => void
  className?: string
}

export function ExcalidrawWrapper({
  scene,
  className,
}: ExcalidrawWrapperProps) {
  return (
    <ExcalidrawCanvas
      scene={scene}
      viewMode
      className={className ?? 'pointer-events-auto absolute inset-0'}
    />
  )
}
