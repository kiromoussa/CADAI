'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import type { ViolationRow } from '@/types/database'

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

function applyElementTheming(
  viewer: Autodesk.Viewing.GuiViewer3D,
  violationList: ViolationRow[]
) {
  const THREE = (window as Window & { THREE?: { Vector4: new (x: number, y: number, z: number, w: number) => unknown } }).THREE
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
}: ForgeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Autodesk.Viewing.GuiViewer3D | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [sdkReady, setSdkReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const pins: Pin[] = violations
    .map((v, index) => ({
      id: v.id,
      dbId: v.element_id ? parseInt(v.element_id, 10) : NaN,
      index: index + 1,
      severity: v.severity,
    }))
    .filter((p) => !Number.isNaN(p.dbId))

  useEffect(() => {
    if (!sdkReady || !containerRef.current || viewerRef.current) return

    let cancelled = false

    async function init() {
      try {
        const tokenRes = await fetch(`/api/aps/token?urn=${encodeURIComponent(urn)}`)
        const tokenData = (await tokenRes.json()) as {
          access_token?: string
          error?: string
        }
        if (!tokenRes.ok || !tokenData.access_token) {
          throw new Error(tokenData.error ?? 'Failed to get viewer token')
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

        const documentId = `urn:${urn}`
        Autodesk.Viewing.Document.load(
          documentId,
          (doc) => {
            const root = doc.getRoot()
            const sheetViews = root.search({ type: 'geometry', role: '2d' })
            const viewable =
              (sheetViews && sheetViews.length > 0 ? sheetViews[0] : null) ??
              root.getDefaultGeometry()
            if (!viewable) {
              setError('No viewable 2D sheet in model')
              setLoading(false)
              return
            }
            viewer
              .loadDocumentNode(doc, viewable)
              .then(() => {
                setLoading(false)
                applyElementTheming(viewer, violations)
                updatePins(viewer, pins)
              })
              .catch((err: Error) => {
                setError(err.message)
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
      if (viewerRef.current) {
        viewerRef.current.finish()
        viewerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkReady, urn])

  function updatePins(viewer: Autodesk.Viewing.GuiViewer3D, currentPins: Pin[]) {
    const overlay = overlayRef.current
    if (!overlay) return

    overlay.innerHTML = ''
    const canvas = viewer.container.querySelector('canvas')
    if (!canvas) return

    for (const pin of currentPins) {
      try {
        viewer.model.getData().instanceTree.enumNodeFragments(
          pin.dbId,
          (fragId: number) => {
            const bounds = new window.Autodesk!.Viewing.BoundingBox()
            viewer.model.getFragmentList().getWorldBounds(fragId, bounds)
            const center = bounds.center()
            const screen = viewer.worldToClient(center)

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
            el.onclick = () => onSelect(pin.id)
            if (selectedId === pin.id) {
              el.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.8)'
            }
            overlay.appendChild(el)
          },
          true
        )
      } catch {
        // Element may not exist in this view
      }
    }
  }

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !viewer.model) return
    applyElementTheming(viewer, violations)
  }, [violations])

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
    const viewer = viewerRef.current
    if (!viewer || !locateViolation?.element_id) return

    const dbId = parseInt(locateViolation.element_id, 10)
    if (Number.isNaN(dbId)) return

    viewer.select([dbId])
    viewer.fitToView([dbId], viewer.model, true)
    onSelect(locateViolation.id)
  }, [locateViolation, onSelect])

  useEffect(() => {
    if (!selectedId || !viewerRef.current) return
    const pin = pins.find((p) => p.id === selectedId)
    if (!pin) return
    viewerRef.current.select([pin.dbId])
  }, [selectedId, pins])

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
    <div className="relative h-full w-full bg-background">
      <Script
        src="https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js"
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
      />
      <div ref={containerRef} className="absolute inset-0" />
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 [&_.forge-pin]:pointer-events-auto" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-sm text-text-secondary">
          Loading drawing…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/90 p-6 text-center text-sm text-severity-violation">
          {error}
        </div>
      )}
    </div>
  )
}

// Minimal Autodesk typings for viewer usage
declare namespace Autodesk {
  namespace Viewing {
    class GuiViewer3D {
      constructor(container: HTMLElement, config?: object)
      start(): void
      finish(): void
      setTheme(theme: string): void
      loadDocumentNode(
        doc: Document,
        node: BubbleNode
      ): Promise<void>
      container: HTMLElement
      model: Model
      select(dbIds: number[]): void
      fitToView(
        dbIds: number[],
        model: Model,
        immediate?: boolean
      ): void
      worldToClient(point: { x: number; y: number; z: number }): { x: number; y: number }
      addEventListener(event: string, callback: () => void): void
      removeEventListener(event: string, callback: () => void): void
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
      search(criteria: { type?: string; role?: string }): BubbleNode[] | null
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
