'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Script from 'next/script'
import { disciplineLabel } from '@/lib/analysis/disciplines'
import type { Discipline } from '@/types/analysis'
import type { ViolationRow } from '@/types/database'
import { SheetSwitcher, type ViewerSheet } from '@/components/viewer/SheetSwitcher'
import { ViewerToolbar } from '@/components/viewer/ViewerToolbar'
import {
  configure2DNavigation,
  fitViewerHome,
  fitViewerToModel,
  getDbIdScreenCenter,
  locateDbIds,
  type ForgeViewerLike,
  waitForViewerModel,
  zoomViewer,
} from '@/lib/viewer/forge-navigation'

declare global {
  interface Window {
    Autodesk?: typeof Autodesk
  }
}

interface ForgeViewerProps {
  urn: string
  violations: ViolationRow[]
  selectedId: string | null
  onSelect: (id: string) => void
  locateViolation: ViolationRow | null
  onSheetChange?: (sheet: ViewerSheet) => void
}

interface Pin {
  id: string
  dbId: number
  index: number
  severity: string
}

const severityColor: Record<string, string> = {
  violation: '#EF4444',
  warning: '#F97316',
  pass: '#22C55E',
}

const severityTheming: Record<string, { r: number; g: number; b: number; a: number }> = {
  violation: { r: 1, g: 0, b: 0, a: 0.8 },
  warning: { r: 1, g: 0.6, b: 0, a: 0.8 },
  pass: { r: 0, g: 0.8, b: 0, a: 0.5 },
}

/** Viewer v7 uses guid(); v6 used getGuid(). */
type ForgeBubbleNode = Autodesk.Viewing.BubbleNode & {
  getGuid?: () => string
  guid?: () => string
  findByGuid?: (guid: string) => ForgeBubbleNode | null
  parent?: ForgeBubbleNode
  data?: { guid?: string; name?: string }
}

function bubbleNodeGuid(node: ForgeBubbleNode): string {
  if (typeof node.guid === 'function') return node.guid()
  if (typeof node.getGuid === 'function') return node.getGuid()
  return node.data?.guid ?? ''
}

function bubbleNodeName(node: ForgeBubbleNode): string {
  if (typeof node.name === 'function') return node.name()
  return node.data?.name ?? 'Sheet'
}

function resolveBubbleNode(
  root: ForgeBubbleNode,
  node: ForgeBubbleNode
): ForgeBubbleNode {
  const guid = bubbleNodeGuid(node)
  if (guid && typeof root.findByGuid === 'function') {
    const found = root.findByGuid(guid) as ForgeBubbleNode | null
    if (found) return found
  }
  return node
}

type SheetNodeEntry = {
  /** Metadata / geometry GUID (matches APS API and violations). */
  guid: string
  /** Node passed to loadDocumentNode. */
  node: ForgeBubbleNode
}

function sheetEntryFromBubble(
  root: ForgeBubbleNode,
  node: ForgeBubbleNode
): SheetNodeEntry {
  const resolved = resolveBubbleNode(root, node)
  return {
    guid: bubbleNodeGuid(resolved) || bubbleNodeGuid(node),
    node: resolved,
  }
}

const LOAD_2D_OPTIONS = {
  preserveView: false,
  modelSpace: true,
} as const

function asForgeNav(viewer: Autodesk.Viewing.GuiViewer3D): ForgeViewerLike {
  return viewer as unknown as ForgeViewerLike
}

function applyElementTheming(
  viewer: Autodesk.Viewing.GuiViewer3D,
  violationList: ViolationRow[]
) {
  const THREE = (
    window as Window & {
      THREE?: { Vector4: new (x: number, y: number, z: number, w: number) => unknown }
    }
  ).THREE
  if (!THREE || !viewer.model) return

  const themedViewer = viewer as Autodesk.Viewing.GuiViewer3D & {
    clearThemingColors: (model: Autodesk.Viewing.Model) => void
    setThemingColor: (
      dbId: number,
      color: unknown,
      model: Autodesk.Viewing.Model,
      recursive?: boolean
    ) => void
  }

  themedViewer.clearThemingColors(viewer.model)

  for (const v of violationList) {
    if (!v.element_id) continue
    const dbId = parseInt(v.element_id, 10)
    if (Number.isNaN(dbId)) continue
    const tone = severityTheming[v.severity] ?? severityTheming.warning
    themedViewer.setThemingColor(
      dbId,
      new THREE.Vector4(tone.r, tone.g, tone.b, tone.a),
      viewer.model,
      true
    )
  }
}

export function ForgeViewer({
  urn,
  violations,
  selectedId,
  onSelect,
  locateViolation,
  onSheetChange,
}: ForgeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Autodesk.Viewing.GuiViewer3D | null>(null)
  const docRef = useRef<Autodesk.Viewing.Document | null>(null)
  const sheetNodesRef = useRef<SheetNodeEntry[]>([])
  const overlayRef = useRef<HTMLDivElement>(null)
  const [sdkReady, setSdkReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sheetLoading, setSheetLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissedError, setDismissedError] = useState(false)
  const [activeSheetGuid, setActiveSheetGuid] = useState<string | null>(null)
  const [sheetMeta, setSheetMeta] = useState<
    Array<{ guid: string; name: string; discipline: Discipline }>
  >([])
  const [documentSheets, setDocumentSheets] = useState<ViewerSheet[]>([])
  const [viewerReady, setViewerReady] = useState(false)
  const locateSeqRef = useRef(0)

  const sheets: ViewerSheet[] = useMemo(() => {
    return documentSheets.map((sheet) => ({
      ...sheet,
      violationCount: violations.filter(
        (v) => !v.sheet_guid || v.sheet_guid === sheet.guid
      ).length,
    }))
  }, [documentSheets, violations])

  const activeSheetViolations = useMemo(
    () =>
      violations.filter(
        (v) => !activeSheetGuid || !v.sheet_guid || v.sheet_guid === activeSheetGuid
      ),
    [violations, activeSheetGuid]
  )

  const pins: Pin[] = activeSheetViolations
    .map((v, index) => ({
      id: v.id,
      dbId: v.element_id ? parseInt(v.element_id, 10) : NaN,
      index: index + 1,
      severity: v.severity,
    }))
    .filter((p) => !Number.isNaN(p.dbId))

  const loadSheet = useCallback(
    async (
      guid: string,
      options?: { preserveView?: boolean; fitAfterLoad?: boolean }
    ) => {
      const viewer = viewerRef.current
      const doc = docRef.current
      if (!viewer || !doc) return

      const entry = sheetNodesRef.current.find((n) => n.guid === guid)
      if (!entry) return

      setSheetLoading(true)
      setError(null)
      setDismissedError(false)

      try {
        await viewer.loadDocumentNode(doc, entry.node, {
          ...LOAD_2D_OPTIONS,
          preserveView: options?.preserveView ?? LOAD_2D_OPTIONS.preserveView,
        } as Autodesk.Viewing.LoadModelOptions)
        await waitForViewerModel(asForgeNav(viewer))
        configure2DNavigation(asForgeNav(viewer))
        setActiveSheetGuid(guid)
        const sheet = documentSheets.find((s) => s.guid === guid)
        if (sheet) onSheetChange?.(sheet)

        const themed = violations.filter(
          (v) => !v.sheet_guid || v.sheet_guid === guid
        )
        applyElementTheming(viewer, themed)
        if (options?.fitAfterLoad) {
          fitViewerToModel(asForgeNav(viewer), false)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sheet')
      } finally {
        setSheetLoading(false)
      }
    },
    [documentSheets, onSheetChange, violations]
  )

  useEffect(() => {
    if (!sdkReady || !containerRef.current || viewerRef.current) return

    let cancelled = false

    async function init() {
      try {
        const [tokenRes, sheetsRes] = await Promise.all([
          fetch(`/api/aps/token?urn=${encodeURIComponent(urn)}`),
          fetch(`/api/aps/sheets?urn=${encodeURIComponent(urn)}`),
        ])

        const tokenData = (await tokenRes.json()) as {
          access_token?: string
          error?: string
        }
        if (!tokenRes.ok || !tokenData.access_token) {
          throw new Error(tokenData.error ?? 'Failed to get viewer token')
        }

        let apiSheets: Array<{ guid: string; name: string; discipline: Discipline }> = []
        if (sheetsRes.ok) {
          const sheetsData = (await sheetsRes.json()) as {
            sheets?: Array<{ guid: string; name: string; discipline: Discipline }>
          }
          apiSheets = sheetsData.sheets ?? []
          setSheetMeta(apiSheets)
        }

        const Autodesk = window.Autodesk
        if (!Autodesk) throw new Error('Forge Viewer SDK not loaded')

        const options: Autodesk.Viewing.InitializerOptions = {
          env: 'AutodeskProduction2',
          getAccessToken: (callback) => callback(tokenData.access_token!, 3600),
        }

        await new Promise<void>((resolve, reject) => {
          Autodesk.Viewing.Initializer(options, resolve, reject)
        })

        if (cancelled || !containerRef.current) return

        const viewer = new Autodesk.Viewing.GuiViewer3D(containerRef.current, {
          extensions: [],
        })
        viewerRef.current = viewer
        viewer.start()
        viewer.setTheme('dark-theme')
        viewer.setBackgroundColor(30, 30, 30, 255, 30, 30, 30, 255)
        configure2DNavigation(asForgeNav(viewer))
        setViewerReady(true)

        try {
          await viewer.loadExtension('Autodesk.PDF')
        } catch {
          // Optional — only needed for PDF-based 2D viewables
        }

        const documentId = `urn:${urn}`
        Autodesk.Viewing.Document.load(
          documentId,
          (doc) => {
            docRef.current = doc
            const root = doc.getRoot() as ForgeBubbleNode
            const sheetViews =
              root.search?.({ type: 'geometry', role: '2d' }, true) ??
              root.search?.({ type: 'geometry', role: '2d' }) ??
              []

            if (sheetViews.length === 0) {
              const fallback = root.getDefaultGeometry?.()
              if (!fallback) {
                setError(
                  'No viewable 2D sheets in this drawing. Re-upload the DWG to refresh translation.'
                )
                setLoading(false)
                return
              }
              sheetNodesRef.current = [
                sheetEntryFromBubble(root, fallback as ForgeBubbleNode),
              ]
            } else {
              sheetNodesRef.current = sheetViews.map((node) =>
                sheetEntryFromBubble(root, node as ForgeBubbleNode)
              )
            }

            const metaByGuid = new Map(apiSheets.map((s) => [s.guid, s] as const))

            setDocumentSheets(
              sheetNodesRef.current.map((entry) => {
                const meta = metaByGuid.get(entry.guid)
                return {
                  guid: entry.guid,
                  name: meta?.name ?? bubbleNodeName(entry.node),
                  discipline: meta?.discipline ?? ('general' as Discipline),
                }
              })
            )

            const firstGuid = sheetNodesRef.current[0]?.guid
            if (!firstGuid) {
              setError('No viewable 2D sheets in this drawing')
              setLoading(false)
              return
            }

            viewer
              .loadDocumentNode(
                doc,
                sheetNodesRef.current[0]!.node,
                LOAD_2D_OPTIONS
              )
              .then(async () => {
                await waitForViewerModel(asForgeNav(viewer))
                configure2DNavigation(asForgeNav(viewer))
                setActiveSheetGuid(firstGuid)
                setLoading(false)
                applyElementTheming(viewer, violations)
                updatePins(viewer, pins)
              })
              .catch((err: Error) => {
                const msg = err.message.toLowerCase()
                if (
                  msg.includes('not supported') ||
                  msg.includes('extension')
                ) {
                  setError(
                    'This drawing was translated in a format the viewer cannot display. Re-upload the DWG file to refresh translation.'
                  )
                } else {
                  setError(err.message)
                }
                setLoading(false)
              })
          },
          (code, message) => {
            setError(`${code}: ${message}`)
            setLoading(false)
          }
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Viewer init failed')
        setLoading(false)
      }
    }

    init()

    return () => {
      cancelled = true
      setViewerReady(false)
      if (viewerRef.current) {
        viewerRef.current.finish()
        viewerRef.current = null
      }
      docRef.current = null
      sheetNodesRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkReady, urn])

  function updatePins(viewer: Autodesk.Viewing.GuiViewer3D, currentPins: Pin[]) {
    const overlay = overlayRef.current
    if (!overlay) return

    overlay.innerHTML = ''
    const canvas = viewer.container.querySelector('canvas')
    if (!canvas || !viewer.model) return

    for (const pin of currentPins) {
      try {
        const screen = getDbIdScreenCenter(asForgeNav(viewer), pin.dbId)
        if (!screen) continue

        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'forge-pin'
        el.style.position = 'absolute'
        el.style.left = `${screen.x - 12}px`
        el.style.top = `${screen.y - 12}px`
        el.style.width = '24px'
        el.style.height = '24px'
        el.style.borderRadius = '9999px'
        el.style.border = '2px solid white'
        el.style.background = severityColor[pin.severity] ?? '#3B82F6'
        el.style.color = '#0A0F1E'
        el.style.fontSize = '11px'
        el.style.fontWeight = '700'
        el.style.cursor = 'pointer'
        el.style.zIndex = '10'
        el.textContent = String(pin.index)
        el.onclick = (event) => {
          event.stopPropagation()
          onSelect(pin.id)
        }
        if (selectedId === pin.id) {
          el.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.8)'
        }
        overlay.appendChild(el)
      } catch {
        // Element may not exist on this sheet
      }
    }
  }

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !viewer.model) return
    applyElementTheming(viewer, activeSheetViolations)
  }, [activeSheetViolations])

  useEffect(() => {
    const viewer = viewerRef.current
    const AutodeskViewing = window.Autodesk?.Viewing
    if (!viewer || !viewer.model || !AutodeskViewing) return

    const refresh = () => updatePins(viewer, pins)
    viewer.addEventListener(AutodeskViewing.CAMERA_CHANGE_EVENT, refresh)
    viewer.addEventListener(AutodeskViewing.GEOMETRY_LOADED_EVENT, refresh)
    refresh()

    return () => {
      viewer.removeEventListener(AutodeskViewing.CAMERA_CHANGE_EVENT, refresh)
      viewer.removeEventListener(AutodeskViewing.GEOMETRY_LOADED_EVENT, refresh)
    }
  }, [pins, selectedId, onSelect])

  useEffect(() => {
    if (!locateViolation) return

    const seq = ++locateSeqRef.current
    const violation = locateViolation

    async function runLocate() {
      const viewer = viewerRef.current
      if (!viewer) return

      const targetGuid = violation.sheet_guid
      if (targetGuid && targetGuid !== activeSheetGuid) {
        await loadSheet(targetGuid, { preserveView: false, fitAfterLoad: false })
      }
      if (seq !== locateSeqRef.current) return

      await waitForViewerModel(asForgeNav(viewer))
      if (seq !== locateSeqRef.current) return

      configure2DNavigation(asForgeNav(viewer))

      const dbId = violation.element_id
        ? parseInt(violation.element_id, 10)
        : Number.NaN
      if (!Number.isNaN(dbId)) {
        locateDbIds(asForgeNav(viewer), [dbId], { animate: true })
      } else {
        fitViewerToModel(asForgeNav(viewer), false)
      }

      onSelect(violation.id)
    }

    void runLocate()
  }, [locateViolation, activeSheetGuid, loadSheet, onSelect])

  useEffect(() => {
    if (!selectedId || !viewerRef.current) return
    const pin = pins.find((p) => p.id === selectedId)
    if (!pin) return
    viewerRef.current.select([pin.dbId])
  }, [selectedId, pins])

  const activeSheet = sheets.find((s) => s.guid === activeSheetGuid)

  const handleZoomIn = useCallback(() => {
    const viewer = viewerRef.current
    if (viewer) zoomViewer(asForgeNav(viewer), 'in')
  }, [])

  const handleZoomOut = useCallback(() => {
    const viewer = viewerRef.current
    if (viewer) zoomViewer(asForgeNav(viewer), 'out')
  }, [])

  const handleFit = useCallback(() => {
    const viewer = viewerRef.current
    if (viewer) fitViewerToModel(asForgeNav(viewer), false)
  }, [])

  const handleHome = useCallback(() => {
    const viewer = viewerRef.current
    if (viewer) fitViewerHome(asForgeNav(viewer))
  }, [])

  useEffect(() => {
    if (!loading && !sheetLoading) return
    const timeoutMs = sdkReady ? 90_000 : 45_000
    const timer = window.setTimeout(() => {
      setError((prev) =>
        prev ??
        (sdkReady
          ? 'Drawing load timed out. Check your connection and refresh, or re-upload the file.'
          : 'Forge Viewer failed to load. Disable ad blockers and refresh the page.')
      )
      setLoading(false)
      setSheetLoading(false)
    }, timeoutMs)
    return () => window.clearTimeout(timer)
  }, [loading, sheetLoading, sdkReady])

  useEffect(() => {
    if (!sdkReady) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href =
      'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css'
    document.head.appendChild(link)
    return () => {
      document.head.removeChild(link)
    }
  }, [sdkReady])

  return (
    <div className="flex h-full w-full flex-col bg-[#1e1e1e]">
      <Script
        src="https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js"
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
        onError={() => {
          setError(
            'Could not load Autodesk Viewer. Check your network or ad blocker, then refresh.'
          )
          setLoading(false)
        }}
      />

      <SheetSwitcher
        sheets={sheets}
        activeGuid={activeSheetGuid}
        onChange={(guid) => void loadSheet(guid)}
        loading={sheetLoading}
      />

      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="absolute inset-0" />
        <div
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 [&_.forge-pin]:pointer-events-auto"
        />

        {(loading || sheetLoading) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1e1e1e]/90">
            <div className="h-8 w-48 animate-pulse rounded bg-[#2d2d30]" />
            <p className="mt-4 text-sm text-[#9ca3af]">
              {sheetLoading ? 'Loading sheet…' : 'Loading drawing…'}
            </p>
          </div>
        )}

        {error && !dismissedError && (
          <div className="absolute inset-x-4 top-4 rounded-lg border border-red-500/40 bg-[#2d2d30] p-4 shadow-lg">
            <p className="text-sm text-red-300">{error}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {sheets.length > 1 && activeSheetGuid && (
                <button
                  type="button"
                  className="rounded bg-[#0078d4] px-3 py-1 text-xs text-white"
                  onClick={() => {
                    const other = sheets.find((s) => s.guid !== activeSheetGuid)
                    if (other) void loadSheet(other.guid)
                  }}
                >
                  Try another sheet
                </button>
              )}
              <button
                type="button"
                className="rounded border border-[#3c3c3c] px-3 py-1 text-xs text-[#d1d5db]"
                onClick={() => setDismissedError(true)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      <ViewerToolbar
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFit={handleFit}
        onHome={handleHome}
        disabled={!viewerReady || loading || sheetLoading}
        sheetLabel={
          activeSheet
            ? `${activeSheet.name} · ${disciplineLabel(activeSheet.discipline)}`
            : undefined
        }
      />
    </div>
  )
}

declare namespace Autodesk {
  namespace Viewing {
    interface LoadModelOptions {
      preserveView?: boolean
      modelSpace?: boolean
    }
    class GuiViewer3D {
      constructor(container: HTMLElement, config?: object)
      start(): void
      finish(): void
      setTheme(theme: string): void
      setBackgroundColor(
        r: number,
        g: number,
        b: number,
        a: number,
        r2: number,
        g2: number,
        b2: number,
        a2: number
      ): void
      loadExtension(id: string): Promise<unknown>
      loadDocumentNode(
        doc: Document,
        node: BubbleNode,
        options?: LoadModelOptions
      ): Promise<void>
      container: HTMLElement
      model: Model
      navigation: {
        zoomIn?: () => void
        zoomOut?: () => void
        setRequestHomeView?: (flag: boolean) => void
      }
      select(dbIds: number[]): void
      fitToView(dbIds?: number[], model?: Model, immediate?: boolean): void
      worldToClient(point: { x: number; y: number; z: number }): { x: number; y: number }
      addEventListener(event: string, callback: () => void): void
      removeEventListener(event: string, callback: () => void): void
      setNavigationLock?(lock: boolean): void
    }
    class Document {
      static load(
        id: string,
        onSuccess: (doc: Document) => void,
        onError: (code: number, message: string) => void
      ): void
      getRoot(): BubbleNode
    }
    class BubbleNode {
      getDefaultGeometry(): BubbleNode | null
      search(
        criteria: { type?: string; role?: string },
        recursive?: boolean
      ): BubbleNode[] | null
      findByGuid?(guid: string): BubbleNode | null
      /** Viewer v7 */
      guid(): string
      /** Viewer v6 */
      getGuid?(): string
      name(): string
      parent?: BubbleNode
    }
    class Model {
      getBoundingBox(): BoundingBox
      getData(): { instanceTree: InstanceTree }
      getFragmentList(): FragmentList
    }
    class BoundingBox {
      center(): { x: number; y: number; z: number }
    }
    interface InstanceTree {
      enumNodeFragments(
        dbId: number,
        callback: (fragId: number) => void,
        recursive: boolean
      ): void
    }
    interface FragmentList {
      getWorldBounds(fragId: number, bounds: BoundingBox): void
    }
    interface InitializerOptions {
      env: string
      getAccessToken: (callback: (token: string, expire: number) => void) => void
    }
    function Initializer(
      options: InitializerOptions,
      onSuccess: () => void,
      onError: (error: Error) => void
    ): void
    const CAMERA_CHANGE_EVENT: string
    const GEOMETRY_LOADED_EVENT: string
  }
}
