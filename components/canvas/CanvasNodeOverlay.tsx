'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import type { CanvasNodeRow } from '@/types/database'
import type { CanvasNodeContent } from '@/types/canvas'
import type { CanvasViewport } from '@/types/canvas'
import {
  overlayRectToSceneNode,
  sceneNodeToOverlayRect,
  type StageOffset,
} from '@/lib/canvas/overlay-geometry'
import { useExcalidrawStageOffset } from '@/lib/canvas/use-excalidraw-stage-offset'
import { PdfNodeFrame } from '@/components/canvas/nodes/PdfNodeFrame'
import { ForgeNodeFrame, type ForgeNodeProgress } from '@/components/canvas/nodes/ForgeNodeFrame'
import { CodeIngestNode } from '@/components/canvas/nodes/CodeIngestNode'
import { NoteNodeFrame } from '@/components/canvas/nodes/NoteNodeFrame'
import { resolveForgeUrn } from '@/lib/canvas/forge-urn'

const MIN_WIDTH = 220
const MIN_HEIGHT = 160

export interface NodeGeometry {
  x: number
  y: number
  width: number
  height: number
}

interface CanvasNodeOverlayProps {
  nodes: CanvasNodeRow[]
  viewport: CanvasViewport
  containerRef: React.RefObject<HTMLDivElement | null>
  pdfUrls: Record<string, string | null>
  projectUrns: Record<string, string | null>
  forgeProgress?: Record<string, ForgeNodeProgress>
  selectedNodeId: string | null
  onSelectNode: (id: string) => void
  onGeometryChange: (id: string, geometry: NodeGeometry) => void
  onNoteContentChange?: (id: string, text: string) => void
}

type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se'

interface DraftRect {
  left: number
  top: number
  width: number
  height: number
}

function nodeLabel(node: CanvasNodeRow): { label: string; badge: string | null } {
  const content = (node.content ?? {}) as CanvasNodeContent
  const isDocument = content.doc_kind === 'document'
  const label =
    content.label ??
    content.file_name ??
    (node.node_type === 'forge'
      ? 'CAD model'
      : isDocument
        ? 'Document'
        : node.node_type === 'code_ingest'
          ? 'Code'
          : node.node_type === 'note'
            ? 'Note'
            : 'Floor plan')

  let badge: string | null = null
  if (isDocument) badge = 'Reference'
  else if (content.analysis_status === 'running') badge = 'Analyzing…'
  else if (content.analysis_status === 'complete' && node.analysis_id) badge = 'Complete'
  else if (content.upload_status === 'uploading') badge = 'Uploading…'
  else if (content.upload_status === 'translating') badge = 'Translating…'

  return { label, badge }
}

interface NodeWindowProps {
  node: CanvasNodeRow
  base: DraftRect
  viewport: CanvasViewport
  stageOffset: StageOffset
  selected: boolean
  pdfUrl: string | null
  urn: string | null
  forgeProgress?: ForgeNodeProgress
  onSelect: (id: string) => void
  onGeometryChange: (id: string, geometry: NodeGeometry) => void
  onNoteContentChange?: (id: string, text: string) => void
}

function NodeWindow({
  node,
  base,
  viewport,
  stageOffset,
  selected,
  pdfUrl,
  urn,
  forgeProgress,
  onSelect,
  onGeometryChange,
  onNoteContentChange,
}: NodeWindowProps) {
  const [draft, setDraft] = useState<DraftRect | null>(null)
  const gesture = useRef<{
    mode: 'move' | ResizeCorner
    startX: number
    startY: number
    rect: DraftRect
  } | null>(null)

  const rect = draft ?? base
  const zoom = viewport.zoom || 1
  const { label, badge } = nodeLabel(node)

  const commit = useCallback(
    (next: DraftRect) => {
      onGeometryChange(node.id, overlayRectToSceneNode(next, viewport, stageOffset))
    },
    [node.id, onGeometryChange, stageOffset, viewport]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g) return
    const dl = e.clientX - g.startX
    const dt = e.clientY - g.startY
    const { left: L, top: T, width: W, height: H } = g.rect
    const minWidth = MIN_WIDTH * zoom
    const minHeight = MIN_HEIGHT * zoom

    if (g.mode === 'move') {
      setDraft({ left: L + dl, top: T + dt, width: W, height: H })
      return
    }

    let left = L
    let top = T
    let width = W
    let height = H

    if (g.mode === 'se') {
      width = W + dl
      height = H + dt
    } else if (g.mode === 'sw') {
      left = L + dl
      width = W - dl
      height = H + dt
    } else if (g.mode === 'ne') {
      top = T + dt
      width = W + dl
      height = H - dt
    } else {
      // nw
      left = L + dl
      top = T + dt
      width = W - dl
      height = H - dt
    }

    // Clamp to minimums (scene units), keeping the opposite edge anchored.
    if (width < minWidth) {
      if (g.mode === 'sw' || g.mode === 'nw') left = L + (W - minWidth)
      width = minWidth
    }
    if (height < minHeight) {
      if (g.mode === 'ne' || g.mode === 'nw') top = T + (H - minHeight)
      height = minHeight
    }

    setDraft({ left, top, width, height })
    },
    [zoom]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const g = gesture.current
      if (!g) return
      gesture.current = null
      try {
        ;(e.target as Element).releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
      setDraft((current) => {
        if (current) commit(current)
        return null
      })
    },
    [commit]
  )

  const startGesture = useCallback(
    (mode: 'move' | ResizeCorner) => (e: React.PointerEvent) => {
      e.stopPropagation()
      onSelect(node.id)
      gesture.current = {
        mode,
        startX: e.clientX,
        startY: e.clientY,
        rect: { ...rect },
      }
      try {
        ;(e.target as Element).setPointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    },
    [node.id, onSelect, rect]
  )

  const cornerCursor: Record<ResizeCorner, string> = {
    nw: 'nwse-resize',
    se: 'nwse-resize',
    ne: 'nesw-resize',
    sw: 'nesw-resize',
  }

  return (
    <div
      className={
        'pointer-events-auto absolute overflow-hidden rounded-lg border bg-background shadow-xl ' +
        (selected ? 'border-accent ring-1 ring-accent' : 'border-border')
      }
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        zIndex: selected ? 2 : 1,
        boxSizing: 'border-box',
      }}
      onPointerDown={() => onSelect(node.id)}
    >
      {/*
        Inner chrome renders at scene size and is scaled by zoom, so the PDF /
        CAD content zooms visually like a native Excalidraw image.
      */}
      <div
        className="flex flex-col"
        style={{
          width: rect.width / zoom,
          height: rect.height / zoom,
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
        }}
      >
        {/* Title bar — drag to move the window. */}
        <div
          className="flex shrink-0 cursor-move items-center gap-2 border-b border-border bg-surface/90 px-2 py-1 text-xs font-medium text-text-primary"
          onPointerDown={startGesture('move')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <span className="truncate">{label}</span>
          {badge && (
            <span
              className={
                'ml-auto shrink-0 ' +
                (badge === 'Complete' ? 'text-severity-pass' : 'text-text-secondary')
              }
            >
              {badge}
            </span>
          )}
        </div>

        {/* Body — always interactive so scrolling / orbiting works immediately. */}
        <div className="relative min-h-0 flex-1">
          {node.node_type === 'pdf' && <PdfNodeFrame node={node} pdfUrl={pdfUrl} />}
          {node.node_type === 'forge' && (
            <ForgeNodeFrame node={node} urn={urn} progress={forgeProgress} />
          )}
          {node.node_type === 'code_ingest' && <CodeIngestNode node={node} />}
          {node.node_type === 'note' && onNoteContentChange && (
            <NoteNodeFrame node={node} onContentChange={onNoteContentChange} />
          )}
        </div>
      </div>

      {/* Resize handles (corners). */}
      {(['nw', 'ne', 'sw', 'se'] as ResizeCorner[]).map((corner) => (
        <div
          key={corner}
          onPointerDown={startGesture(corner)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="absolute h-4 w-4"
          style={{
            cursor: cornerCursor[corner],
            top: corner.startsWith('n') ? -2 : undefined,
            bottom: corner.startsWith('s') ? -2 : undefined,
            left: corner.endsWith('w') ? -2 : undefined,
            right: corner.endsWith('e') ? -2 : undefined,
          }}
        >
          <div
            className={
              'absolute h-2.5 w-2.5 rounded-sm border ' +
              (selected
                ? 'border-accent bg-accent/80'
                : 'border-border bg-background') +
              ' ' +
              (corner.startsWith('n') ? 'top-0.5' : 'bottom-0.5') +
              ' ' +
              (corner.endsWith('w') ? 'left-0.5' : 'right-0.5')
            }
          />
        </div>
      ))}
    </div>
  )
}

export function CanvasNodeOverlay({
  nodes,
  viewport,
  containerRef,
  pdfUrls,
  projectUrns,
  forgeProgress,
  selectedNodeId,
  onSelectNode,
  onGeometryChange,
  onNoteContentChange,
}: CanvasNodeOverlayProps) {
  const stageOffset = useExcalidrawStageOffset(containerRef)

  // Windows track the canvas like native elements: position and size both scale
  // with zoom, and the inner content scales visually (like an image).
  const bases = useMemo(() => {
    const map = new Map<string, DraftRect>()
    for (const node of nodes) {
      map.set(node.id, sceneNodeToOverlayRect(node, viewport, stageOffset))
    }
    return map
  }, [nodes, stageOffset, viewport])

  return (
    <>
      {nodes.map((node) => {
        const base = bases.get(node.id)
        if (!base) return null
        return (
          <NodeWindow
            key={node.id}
            node={node}
            base={base}
            viewport={viewport}
            stageOffset={stageOffset}
            selected={selectedNodeId === node.id}
            pdfUrl={pdfUrls[node.id] ?? null}
            urn={resolveForgeUrn(node, projectUrns)}
            forgeProgress={forgeProgress?.[node.id]}
            onSelect={onSelectNode}
            onGeometryChange={onGeometryChange}
            onNoteContentChange={onNoteContentChange}
          />
        )
      })}
    </>
  )
}
