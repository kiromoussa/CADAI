'use client'

import dynamic from 'next/dynamic'
import type { RefObject } from 'react'
import { CanvasNodeOverlay, type NodeGeometry } from '@/components/canvas/CanvasNodeOverlay'
import type { ForgeNodeProgress } from '@/components/canvas/nodes/ForgeNodeFrame'
import type { ExcalidrawBoardApi, ExcalidrawScene, CanvasViewport } from '@/types/canvas'
import type { CanvasNodeRow } from '@/types/database'

const ExcalidrawCanvas = dynamic(
  () =>
    import('@/components/canvas/ExcalidrawCanvas').then((m) => ({
      default: m.ExcalidrawCanvas,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#121212] text-sm text-text-secondary">
        Loading board…
      </div>
    ),
  }
)

export interface BoardCanvasWorkspaceProps {
  containerRef: RefObject<HTMLDivElement | null>
  scene: ExcalidrawScene
  nodes: CanvasNodeRow[]
  viewport: CanvasViewport
  pdfUrls: Record<string, string | null>
  projectUrns: Record<string, string | null>
  forgeProgress: Record<string, ForgeNodeProgress>
  selectedNodeId: string | null
  planImportBusy: boolean
  onSceneChange: (scene: ExcalidrawScene) => void
  onViewportChange: (viewport: CanvasViewport) => void
  onExcalidrawApi: (api: ExcalidrawBoardApi) => void
  onAddPdf: (file: File) => void
  onAddDwg: (file: File) => void
  onAddDocument: (file: File) => void
  onAddNote?: () => void
  onSelectNode: (nodeId: string | null) => void
  onGeometryChange: (nodeId: string, geometry: NodeGeometry) => void
  onNoteContentChange?: (nodeId: string, text: string) => void
  toolsPanelOpen?: boolean
}

export function BoardCanvasWorkspace({
  containerRef,
  scene,
  nodes,
  viewport,
  pdfUrls,
  projectUrns,
  forgeProgress,
  selectedNodeId,
  planImportBusy,
  onSceneChange,
  onViewportChange,
  onExcalidrawApi,
  onAddPdf,
  onAddDwg,
  onAddDocument,
  onAddNote,
  onSelectNode,
  onGeometryChange,
  onNoteContentChange,
}: BoardCanvasWorkspaceProps) {
  return (
    <ExcalidrawCanvas
      scene={scene}
      onSceneChange={onSceneChange}
      onViewportChange={onViewportChange}
      onExcalidrawApi={onExcalidrawApi}
      onAddPdf={onAddPdf}
      onAddDwg={onAddDwg}
      onAddDocument={onAddDocument}
      onAddNote={onAddNote}
      planImportBusy={planImportBusy}
      className="h-full w-full min-h-0"
      overlay={
        <CanvasNodeOverlay
          nodes={nodes}
          viewport={viewport}
          containerRef={containerRef}
          pdfUrls={pdfUrls}
          projectUrns={projectUrns}
          forgeProgress={forgeProgress}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
          onGeometryChange={onGeometryChange}
          onNoteContentChange={onNoteContentChange}
        />
      }
    />
  )
}
