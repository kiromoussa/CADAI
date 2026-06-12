'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CanvasToolbar } from '@/components/canvas/CanvasToolbar'
import type { NodeGeometry } from '@/components/canvas/CanvasNodeOverlay'
import type { ForgeNodeProgress } from '@/components/canvas/nodes/ForgeNodeFrame'
import { ProjectSetupModal } from '@/components/projects/ProjectSetupModal'
import { uploadCadDirectToOss, waitForCadTranslation } from '@/lib/aps/cad-upload-client'
import {
  parseSceneJson,
  sceneChangeSignature,
  stripNodeFrameElements,
} from '@/lib/canvas/sync-scene'
import {
  projectSetupFromFileName,
  type ProjectSetupValues,
} from '@/lib/projects/constants'
import type { AnalysisProgressEvent } from '@/types/analysis'
import type {
  CanvasViewport,
  ExcalidrawBoardApi,
  ExcalidrawScene,
} from '@/types/canvas'
import type { CanvasBoardRow, CanvasNodeRow } from '@/types/database'

const BoardCanvasWorkspace = dynamic(
  () =>
    import('@/components/canvas/BoardCanvasWorkspace').then((m) => ({
      default: m.BoardCanvasWorkspace,
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

interface BoardPageClientProps {
  board: CanvasBoardRow
  initialNodes: CanvasNodeRow[]
  initialPdfUrls: Record<string, string | null>
  initialProjectUrns: Record<string, string | null>
}

function randomElementId(): string {
  return `node-${crypto.randomUUID().slice(0, 8)}`
}

export default function BoardPageClient({
  board,
  initialNodes,
  initialPdfUrls,
  initialProjectUrns,
}: BoardPageClientProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nodesRef = useRef(initialNodes)
  const excalidrawApiRef = useRef<ExcalidrawBoardApi | null>(null)
  const isProgrammaticSceneUpdateRef = useRef(false)
  const hasStrippedLiveFramesRef = useRef(false)

  const [title, setTitle] = useState(board.title)
  // Node windows (PDF/DWG/code) are rendered by the overlay and own their own
  // geometry — so strip any legacy Excalidraw frame elements that were linked to
  // a node out of the scene to avoid double-rendering and zoom rescaling.
  const initialSceneRef = useRef<ExcalidrawScene | null>(null)
  const [scene, setScene] = useState<ExcalidrawScene>(() => {
    const parsed = parseSceneJson(board.scene_json)
    const nodeElementIds = new Set(
      initialNodes
        .map((n) => n.excalidraw_element_id)
        .filter((id): id is string => Boolean(id))
    )
    const initial = stripNodeFrameElements(parsed, nodeElementIds)
    initialSceneRef.current = initial
    return initial
  })
  const lastSceneSigRef = useRef(
    initialSceneRef.current ? sceneChangeSignature(initialSceneRef.current) : ''
  )
  const [nodes, setNodes] = useState<CanvasNodeRow[]>(initialNodes)
  const [pdfUrls, setPdfUrls] = useState(initialPdfUrls)
  const [projectUrns, setProjectUrns] = useState(initialProjectUrns)
  const [viewport, setViewport] = useState<CanvasViewport>({ scrollX: 0, scrollY: 0, zoom: 1 })
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initialNodes[0]?.id ?? null
  )
  const [analyzing, setAnalyzing] = useState(false)
  const [planImportBusy, setPlanImportBusy] = useState(false)
  const [progressMessage, setProgressMessage] = useState('')
  // Per-node upload/translation progress for CAD nodes — drives the step tracker
  // rendered inside each forge window while it uploads and translates.
  const [forgeProgress, setForgeProgress] = useState<Record<string, ForgeNodeProgress>>({})
  // A file awaiting the jurisdiction/project-type onboarding modal. 'plan' = a
  // building-plan PDF, 'dwg' = a CAD model. Plain reference documents skip this.
  const [pendingUpload, setPendingUpload] = useState<{
    file: File
    kind: 'plan' | 'dwg'
  } | null>(null)

  nodesRef.current = nodes

  const stripLiveNodeFrames = useCallback((api: ExcalidrawBoardApi) => {
    const nodeElementIds = new Set(
      nodesRef.current
        .map((n) => n.excalidraw_element_id)
        .filter((id): id is string => Boolean(id))
    )
    const live: ExcalidrawScene = {
      elements: [...api.getSceneElements()] as unknown as ExcalidrawScene['elements'],
      appState: api.getAppState() as Record<string, unknown>,
      files: api.getFiles() as Record<string, unknown>,
    }
    const cleaned = stripNodeFrameElements(live, nodeElementIds)
    if (cleaned.elements.length === live.elements.length) return

    isProgrammaticSceneUpdateRef.current = true
    try {
      api.updateScene({
        elements: cleaned.elements,
      })
      setScene(cleaned)
    } finally {
      queueMicrotask(() => {
        isProgrammaticSceneUpdateRef.current = false
      })
    }
  }, [])

  const handleExcalidrawApiReady = useCallback(
    (api: ExcalidrawBoardApi) => {
      excalidrawApiRef.current = api
      if (hasStrippedLiveFramesRef.current) return
      hasStrippedLiveFramesRef.current = true
      stripLiveNodeFrames(api)
    },
    [stripLiveNodeFrames]
  )

  const handleViewportChange = useCallback((next: CanvasViewport) => {
    setViewport((prev) =>
      prev.scrollX === next.scrollX &&
      prev.scrollY === next.scrollY &&
      prev.zoom === next.zoom
        ? prev
        : next
    )
  }, [])

  const persistBoard = useCallback(
    async (patch: { title?: string; scene_json?: ExcalidrawScene }) => {
      await fetch(`/api/boards/${board.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: patch.title,
          scene_json: patch.scene_json,
        }),
      })
    },
    [board.id]
  )

  const scheduleSave = useCallback(
    (nextScene: ExcalidrawScene, nextTitle?: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        persistBoard({ scene_json: nextScene, title: nextTitle ?? title })
      }, 1200)
    },
    [persistBoard, title]
  )

  const handleSceneChange = useCallback(
    (nextScene: ExcalidrawScene) => {
      const nodeElementIds = new Set(
        nodesRef.current
          .map((n) => n.excalidraw_element_id)
          .filter((id): id is string => Boolean(id))
      )
      const cleaned = stripNodeFrameElements(nextScene, nodeElementIds)
      const sig = sceneChangeSignature(cleaned)

      if (isProgrammaticSceneUpdateRef.current) {
        if (sig !== lastSceneSigRef.current) {
          lastSceneSigRef.current = sig
          setScene(cleaned)
          scheduleSave(cleaned)
        }
        return
      }

      if (cleaned.elements.length !== nextScene.elements.length) {
        isProgrammaticSceneUpdateRef.current = true
        try {
          excalidrawApiRef.current?.updateScene({
            elements: cleaned.elements,
          })
        } finally {
          queueMicrotask(() => {
            isProgrammaticSceneUpdateRef.current = false
          })
        }
      }

      if (sig === lastSceneSigRef.current) return
      lastSceneSigRef.current = sig
      setScene(cleaned)
      scheduleSave(cleaned)
    },
    [scheduleSave]
  )

  // Node windows own their geometry. When the user drags/resizes a window the
  // overlay reports the new scene-space x/y and pixel width/height; persist it.
  const geometryTimer = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const handleNodeGeometryChange = useCallback(
    (nodeId: string, geometry: NodeGeometry) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === nodeId ? { ...n, ...geometry } : n))
      )
      const timers = geometryTimer.current
      const existing = timers.get(nodeId)
      if (existing) clearTimeout(existing)
      timers.set(
        nodeId,
        setTimeout(() => {
          void fetch(`/api/boards/${board.id}/nodes/${nodeId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geometry),
          })
          timers.delete(nodeId)
        }, 400)
      )
    },
    [board.id]
  )

  const handleTitleChange = useCallback(
    (nextTitle: string) => {
      setTitle(nextTitle)
      scheduleSave(scene, nextTitle)
    },
    [scene, scheduleSave]
  )

  const addPdfNode = useCallback(
    async (
      file: File,
      options: { docKind: 'plan' | 'document'; setup?: ProjectSetupValues },
      offsetIndex = nodes.length
    ) => {
      const { docKind, setup } = options
      setPlanImportBusy(true)
      const label = setup?.name ?? file.name.replace(/\.[^.]+$/, '')
      const elementId = randomElementId()
      const x = 80 + (offsetIndex % 3) * 520
      const y = 80 + Math.floor(offsetIndex / 3) * 400

      // Building-plan PDFs persist the chosen jurisdiction as board defaults so the
      // compliance run (LA / state codes) uses the right rule set.
      if (docKind === 'plan' && setup) {
        void fetch(`/api/boards/${board.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            default_city: setup.city,
            default_state: setup.state,
            default_project_type: setup.projectType,
          }),
        })
      }

      const nodeRes = await fetch(`/api/boards/${board.id}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          excalidraw_element_id: elementId,
          node_type: 'pdf',
          x,
          y,
          width: docKind === 'document' ? 420 : 480,
          height: docKind === 'document' ? 320 : 360,
          content: { label, file_name: file.name, doc_kind: docKind },
        }),
      })

      const nodeData = (await nodeRes.json()) as { node?: CanvasNodeRow; error?: string }
      if (!nodeRes.ok || !nodeData.node) {
        setProgressMessage(nodeData.error ?? 'Failed to create node')
        setPlanImportBusy(false)
        return
      }

      const form = new FormData()
      form.append('file', file)
      form.append('project_name', label)
      form.append('doc_kind', docKind)
      if (setup) {
        form.append('city', setup.city)
        form.append('state', setup.state)
        form.append('project_type', setup.projectType)
      }

      const attachRes = await fetch(
        `/api/boards/${board.id}/nodes/${nodeData.node.id}/attach`,
        { method: 'POST', body: form }
      )
      const attachData = (await attachRes.json()) as {
        node?: CanvasNodeRow
        pdf_url?: string | null
        error?: string
      }

      if (!attachRes.ok || !attachData.node) {
        setProgressMessage(attachData.error ?? 'Failed to attach PDF')
        setPlanImportBusy(false)
        return
      }

      setNodes((prev) => [...prev, attachData.node!])
      setPdfUrls((prev) => ({
        ...prev,
        [attachData.node!.id]: attachData.pdf_url ?? null,
      }))
      setSelectedNodeId(attachData.node!.id)
      setProgressMessage(`Attached ${file.name}`)
      setPlanImportBusy(false)
    },
    [board.id, nodes.length]
  )

  const addDwgNode = useCallback(
    async (file: File, setup: ProjectSetupValues, offsetIndex = nodes.length) => {
      setPlanImportBusy(true)
      setProgressMessage(`Uploading ${file.name}…`)

      const elementId = randomElementId()
      const x = 80 + (offsetIndex % 3) * 520
      const y = 80 + Math.floor(offsetIndex / 3) * 400

      let nodeId: string | null = null
      const setNodeStage = (stage: ForgeNodeProgress['stage'], message: string) => {
        if (!nodeId) return
        setForgeProgress((prev) => ({ ...prev, [nodeId!]: { stage, message } }))
      }

      try {
        const nodeRes = await fetch(`/api/boards/${board.id}/nodes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            excalidraw_element_id: elementId,
            node_type: 'forge',
            x,
            y,
            width: 480,
            height: 360,
            content: { label: setup.name, file_name: file.name },
          }),
        })

        const nodeData = (await nodeRes.json()) as { node?: CanvasNodeRow; error?: string }
        if (!nodeRes.ok || !nodeData.node) {
          throw new Error(nodeData.error ?? 'Failed to create node')
        }

        nodeId = nodeData.node.id
        setNodeStage('uploading', 'Uploading drawing to Autodesk…')

        const uploadingNode: CanvasNodeRow = {
          ...nodeData.node,
          content: {
            ...(typeof nodeData.node.content === 'object' && nodeData.node.content !== null
              ? nodeData.node.content
              : {}),
            label: setup.name,
            file_name: file.name,
            upload_status: 'uploading',
          },
        }
        setNodes((prev) => [...prev, uploadingNode])
        setSelectedNodeId(uploadingNode.id)

        void fetch(`/api/boards/${board.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            default_city: setup.city,
            default_state: setup.state,
            default_project_type: setup.projectType,
          }),
        })

        const projectRes = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: setup.name,
            city: setup.city,
            state: setup.state,
            project_type: setup.projectType,
            source_type: 'aps',
            board_id: board.id,
          }),
        })
        const projectData = (await projectRes.json()) as {
          project_id?: string
          error?: string
        }
        if (!projectRes.ok || !projectData.project_id) {
          throw new Error(projectData.error ?? 'Failed to create project')
        }

        setNodes((prev) =>
          prev.map((n) =>
            n.id === uploadingNode.id
              ? {
                  ...n,
                  project_id: projectData.project_id!,
                  content: {
                    ...(typeof n.content === 'object' && n.content !== null ? n.content : {}),
                    upload_status: 'translating',
                  },
                }
              : n
          )
        )

        const upload = await uploadCadDirectToOss(file, projectData.project_id)
        setProjectUrns((prev) => ({
          ...prev,
          [projectData.project_id!]: upload.urn,
        }))
        setNodeStage('translating', 'Translating drawing for preview…')
        await waitForCadTranslation(upload.urn, projectData.project_id, (msg) => {
          setProgressMessage(msg)
          setNodeStage('translating', msg)
        })

        const patchRes = await fetch(
          `/api/boards/${board.id}/nodes/${nodeData.node.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              project_id: projectData.project_id,
              aps_urn: upload.urn,
              content: {
                label: setup.name,
                file_name: file.name,
                upload_status: undefined,
              },
            }),
          }
        )
        const patchData = (await patchRes.json()) as {
          node?: CanvasNodeRow
          error?: string
        }
        if (!patchRes.ok || !patchData.node) {
          throw new Error(patchData.error ?? 'Failed to attach CAD model')
        }

        setNodes((prev) =>
          prev.map((n) => (n.id === uploadingNode.id ? patchData.node! : n))
        )
        setSelectedNodeId(patchData.node!.id)
        setProgressMessage(`Attached ${file.name}`)
        // Translation complete and URN persisted — drop the progress so the
        // window mounts the actual viewer.
        setForgeProgress((prev) => {
          if (!nodeId) return prev
          const next = { ...prev }
          delete next[nodeId]
          return next
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add DWG'
        setProgressMessage(message)
        // Surface the failure inside the node window (resizable error panel).
        setNodeStage('error', message)
      } finally {
        setPlanImportBusy(false)
      }
    },
    [board, nodes.length]
  )

  // Building-plan PDF: ask the onboarding questions first (same as DWG / scanning).
  const handleAddPdf = useCallback((file: File) => {
    setPendingUpload({ file, kind: 'plan' })
  }, [])

  // Normal reference PDF: no onboarding, no compliance — just drop it on the board.
  const handleAddDocument = useCallback(
    (file: File) => {
      void addPdfNode(file, { docKind: 'document' })
    },
    [addPdfNode]
  )

  const handleAddDwg = useCallback((file: File) => {
    setPendingUpload({ file, kind: 'dwg' })
  }, [])

  const handleSetupSubmit = useCallback(
    (setup: ProjectSetupValues) => {
      if (!pendingUpload) return
      const { file, kind } = pendingUpload
      setPendingUpload(null)
      if (kind === 'dwg') {
        void addDwgNode(file, setup)
      } else {
        void addPdfNode(file, { docKind: 'plan', setup })
      }
    },
    [addDwgNode, addPdfNode, pendingUpload]
  )

  const setupInitial = pendingUpload
    ? projectSetupFromFileName(pendingUpload.file.name, {
        city: board.default_city ?? undefined,
        state: board.default_state ?? undefined,
        projectType: board.default_project_type ?? undefined,
      })
    : projectSetupFromFileName('')

  const createReportNode = useCallback(
    async (sourceNodeId: string, analysisId: string) => {
      const sourceNode = nodes.find((n) => n.id === sourceNodeId)
      if (!sourceNode) return

      const reportX = sourceNode.x + sourceNode.width + 40
      const reportY = sourceNode.y
      const elementId = randomElementId()

      const res = await fetch(`/api/boards/${board.id}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          excalidraw_element_id: elementId,
          node_type: 'pdf',
          x: reportX,
          y: reportY,
          width: 420,
          height: sourceNode.height,
          content: {
            label: 'Compliance Report',
            doc_kind: 'document',
            analysis_status: 'complete',
            linked_analysis_id: analysisId,
            linked_source_node_id: sourceNodeId,
          },
          analysis_id: analysisId,
        }),
      })

      const data = (await res.json()) as { node?: CanvasNodeRow; error?: string }
      if (res.ok && data.node) {
        setNodes((prev) => [...prev, data.node!])
        setSelectedNodeId(data.node.id)
      }
    },
    [board.id, nodes]
  )

  const handleRunCompliance = useCallback(
    async (nodeId: string) => {
      setAnalyzing(true)
      setProgressMessage('Starting compliance check…')
      setSelectedNodeId(nodeId)

      const res = await fetch(`/api/boards/${board.id}/nodes/${nodeId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        setProgressMessage(err.error ?? 'Analysis failed to start')
        setAnalyzing(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let analysisId: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.split('\n').find((l) => l.startsWith('data: '))
          if (!line) continue
          try {
            const event = JSON.parse(line.slice(6)) as AnalysisProgressEvent
            if (event.analysis_id) analysisId = event.analysis_id
            setProgressMessage(event.message)
            if (event.stage === 'complete' && analysisId) {
              setNodes((prev) =>
                prev.map((n) =>
                  n.id === nodeId
                    ? {
                        ...n,
                        analysis_id: analysisId,
                        content: {
                          ...(typeof n.content === 'object' && n.content !== null ? n.content : {}),
                          analysis_status: 'complete',
                        },
                      }
                    : n
                )
              )
              await createReportNode(nodeId, analysisId)
              setAnalyzing(false)
              setProgressMessage('Compliance report ready')
              return
            }
            if (event.stage === 'error') {
              setAnalyzing(false)
              setProgressMessage(event.error ?? event.message)
              return
            }
          } catch {
            // ignore
          }
        }
      }

      setAnalyzing(false)
    },
    [board.id, createReportNode]
  )

  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId)
    : undefined
  const canRunCompliance =
    !!selectedNode &&
    (selectedNode.content as { doc_kind?: string } | null)?.doc_kind !== 'document'

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  return (
    <div className="flex h-screen flex-col">
      <ProjectSetupModal
        open={pendingUpload !== null}
        title={
          pendingUpload?.kind === 'dwg' ? 'Set up CAD project' : 'Set up plan project'
        }
        description="Choose jurisdiction and project type before uploading."
        file={pendingUpload?.file ?? null}
        initialValues={setupInitial}
        submitLabel="Upload to board"
        busy={planImportBusy}
        onClose={() => {
          if (!planImportBusy) setPendingUpload(null)
        }}
        onSubmit={handleSetupSubmit}
      />
      <CanvasToolbar
        boardTitle={title}
        onTitleChange={handleTitleChange}
        onRunCompliance={handleRunCompliance}
        selectedNodeId={selectedNodeId}
        canRunCompliance={canRunCompliance}
        analyzing={analyzing}
        progressMessage={progressMessage}
      />
      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden">
        <BoardCanvasWorkspace
          containerRef={containerRef}
          scene={scene}
          nodes={nodes}
          viewport={viewport}
          pdfUrls={pdfUrls}
          projectUrns={projectUrns}
          forgeProgress={forgeProgress}
          selectedNodeId={selectedNodeId}
          planImportBusy={planImportBusy}
          onSceneChange={handleSceneChange}
          onViewportChange={handleViewportChange}
          onExcalidrawApi={handleExcalidrawApiReady}
          onAddPdf={handleAddPdf}
          onAddDwg={handleAddDwg}
          onAddDocument={handleAddDocument}
          onSelectNode={setSelectedNodeId}
          onGeometryChange={handleNodeGeometryChange}
        />
      </div>
    </div>
  )
}
