'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, type ComponentProps, type ReactNode } from 'react'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { ExcalidrawScene, CanvasViewport, ExcalidrawBoardApi } from '@/types/canvas'
import { parseSceneJson, sanitizeAppState } from '@/lib/canvas/sync-scene'
import {
  getInitialLibraryItems,
  librarySignature,
  loadRemoteDefaultLibraries,
  mergeLibraryById,
} from '@/lib/excalidraw/load-cadai-libraries'
import { CanvasBoardDock } from '@/components/canvas/CanvasBoardDock'

import '@excalidraw/excalidraw/index.css'

const Excalidraw = dynamic(
  async () => {
    const { Excalidraw: ExcalidrawRoot, MainMenu } = await import(
      '@excalidraw/excalidraw'
    )

    function CadaiExcalidraw(
      props: ComponentProps<typeof ExcalidrawRoot>
    ) {
      const { children, ...rest } = props
      return (
        <ExcalidrawRoot {...rest}>
          <MainMenu>
            <MainMenu.DefaultItems.SearchMenu />
            <MainMenu.DefaultItems.Help />
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.Separator />
            <MainMenu.DefaultItems.ToggleTheme />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
          </MainMenu>
          {children}
        </ExcalidrawRoot>
      )
    }

    return CadaiExcalidraw
  },
  { ssr: false }
)

export type { CanvasViewport } from '@/types/canvas'

interface ExcalidrawCanvasProps {
  scene: ExcalidrawScene
  onSceneChange?: (scene: ExcalidrawScene) => void
  onViewportChange?: (viewport: CanvasViewport) => void
  onExcalidrawApi?: (api: ExcalidrawBoardApi) => void
  viewMode?: boolean
  className?: string
  onAddPdf?: (file: File) => void
  onAddDwg?: (file: File) => void
  onAddDocument?: (file: File) => void
  planImportBusy?: boolean
  dock?: ReactNode
  /** PDF/CAD node windows — rendered above the canvas but below Excalidraw UI popups. */
  overlay?: ReactNode
}

export function ExcalidrawCanvas({
  scene,
  onSceneChange,
  onViewportChange,
  onExcalidrawApi,
  viewMode = false,
  className,
  onAddPdf,
  onAddDwg,
  onAddDocument,
  planImportBusy,
  dock,
  overlay,
}: ExcalidrawCanvasProps) {
  const libraryItemsRef = useRef<readonly unknown[] | undefined>(
    getInitialLibraryItems(scene.libraryItems)
  )
  const lastLibrarySigRef = useRef(librarySignature(libraryItemsRef.current))
  const isLibraryHydratingRef = useRef(true)
  const onSceneChangeRef = useRef(onSceneChange)
  onSceneChangeRef.current = onSceneChange

  const initialData = useMemo(
    () => ({
      elements: scene.elements,
      appState: {
        ...sanitizeAppState(scene.appState as Record<string, unknown> | undefined),
        viewModeEnabled: viewMode,
        showWelcomeScreen: false,
        theme: 'dark' as const,
        gridModeEnabled: true,
        gridSize: 20,
      },
      files: scene.files ?? {},
      // Sync only — async remote libraries are injected after mount.
      libraryItems: getInitialLibraryItems(scene.libraryItems),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const viewportRef = useRef<CanvasViewport>({ scrollX: 0, scrollY: 0, zoom: 1 })

  // Load public libraries after mount without bubbling through React state.
  useEffect(() => {
    let cancelled = false
    const finishHydration = () => {
      requestAnimationFrame(() => {
        isLibraryHydratingRef.current = false
      })
    }

    void loadRemoteDefaultLibraries().then((remote) => {
      if (cancelled) return
      const api = apiRef.current
      if (!api) {
        finishHydration()
        return
      }

      const merged = mergeLibraryById(
        getInitialLibraryItems(scene.libraryItems),
        remote
      )
      isLibraryHydratingRef.current = true
      libraryItemsRef.current = merged
      lastLibrarySigRef.current = librarySignature(merged)
      api.updateScene({ libraryItems: merged } as Parameters<
        ExcalidrawImperativeAPI['updateScene']
      >[0])
      finishHydration()
    })

    const timeout = window.setTimeout(finishHydration, 5000)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const publishViewport = useCallback(
    (appState: unknown) => {
      const state = appState as {
        scrollX?: number
        scrollY?: number
        zoom?: { value?: number }
      }
      const next: CanvasViewport = {
        scrollX: state.scrollX ?? 0,
        scrollY: state.scrollY ?? 0,
        zoom: state.zoom?.value ?? 1,
      }
      const prev = viewportRef.current
      if (
        prev.scrollX === next.scrollX &&
        prev.scrollY === next.scrollY &&
        prev.zoom === next.zoom
      ) {
        return
      }
      viewportRef.current = next
      onViewportChange?.(next)
    },
    [onViewportChange]
  )

  const handleChange = useCallback(
    (elements: readonly unknown[], appState: unknown, files: unknown) => {
      onSceneChangeRef.current?.({
        elements: elements as ExcalidrawScene['elements'],
        appState: sanitizeAppState(appState as Record<string, unknown>),
        files: files as Record<string, unknown>,
        libraryItems: libraryItemsRef.current,
      })
      publishViewport(appState)
    },
    [publishViewport]
  )

  const handleLibraryChange = useCallback((libraryItems: readonly unknown[]) => {
    const sig = librarySignature(libraryItems)
    if (sig === lastLibrarySigRef.current) return

    lastLibrarySigRef.current = sig
    libraryItemsRef.current = libraryItems

    if (isLibraryHydratingRef.current) return

    const api = apiRef.current
    onSceneChangeRef.current?.({
      elements: (api?.getSceneElements() ?? []) as unknown as ExcalidrawScene['elements'],
      appState: sanitizeAppState(
        (api?.getAppState() ?? {}) as Record<string, unknown>
      ),
      files: (api?.getFiles() ?? {}) as Record<string, unknown>,
      libraryItems,
    })
  }, [])

  const handleScrollChange = useCallback(
    (_scrollX: number, _scrollY: number, _zoom: { value: number }) => {
      const appState = apiRef.current?.getAppState()
      if (appState) publishViewport(appState)
    },
    [publishViewport]
  )

  const handleExcalidrawApi = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      apiRef.current = api
      onExcalidrawApi?.(api as ExcalidrawBoardApi)
      publishViewport(api.getAppState())
    },
    [onExcalidrawApi, publishViewport]
  )

  const showDock = !viewMode && onAddPdf && onAddDwg && onAddDocument

  return (
    <div className={`excalidraw-board-host relative ${className ?? 'h-full w-full min-h-0'}`}>
      <div className="excalidraw-board-stage relative h-full w-full min-h-0">
        <Excalidraw
          initialData={initialData as unknown as Record<string, unknown>}
          onChange={handleChange}
          onLibraryChange={handleLibraryChange}
          onScrollChange={handleScrollChange}
          excalidrawAPI={handleExcalidrawApi}
          viewModeEnabled={viewMode}
          gridModeEnabled
          theme="dark"
          UIOptions={{
            canvasActions: {
              loadScene: false,
              export: false,
              saveToActiveFile: false,
            },
          }}
        />
      </div>
      {overlay ? (
        <div className="canvas-node-overlay pointer-events-none absolute inset-0 overflow-hidden">
          {overlay}
        </div>
      ) : null}
      {showDock && (
        <CanvasBoardDock
          onAddPdf={onAddPdf}
          onAddDwg={onAddDwg}
          onAddDocument={onAddDocument}
          busy={planImportBusy}
        />
      )}
      {dock}
    </div>
  )
}

export function sceneFromJson(raw: unknown): ExcalidrawScene {
  return parseSceneJson(raw)
}
