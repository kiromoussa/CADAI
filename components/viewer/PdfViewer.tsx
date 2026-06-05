'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import type { ViolationRow } from '@/types/database'

GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs'

interface PdfViewerProps {
  pdfUrl: string
  violations: ViolationRow[]
  selectedId: string | null
  onSelect: (id: string) => void
  locateViolation?: ViolationRow | null
}

interface PinLayout {
  id: string
  index: number
  severity: string
  label: string
  topPct: number
}

export function PdfViewer({
  pdfUrl,
  violations,
  selectedId,
  onSelect,
  locateViolation,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pageCount, setPageCount] = useState(1)
  const [pageNumber, setPageNumber] = useState(1)

  const pins = useMemo<PinLayout[]>(() => {
    const list = violations.filter(
      (v) => v.element_location || v.element_name || v.finding
    )
    return list.map((v, i) => ({
      id: v.id,
      index: i + 1,
      severity: v.severity,
      label: v.element_location ?? v.element_name ?? v.finding.slice(0, 48),
      topPct: ((i + 1) / (list.length + 1)) * 100,
    }))
  }, [violations])

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    async function renderPage() {
      setLoading(true)
      setError(null)
      try {
        const doc = await getDocument(pdfUrl).promise
        if (cancelled) return
        setPageCount(doc.numPages)
        const page = await doc.getPage(pageNumber)
        if (cancelled) return

        const baseViewport = page.getViewport({ scale: 1 })
        const width = container!.clientWidth || baseViewport.width
        const scale = width / baseViewport.width
        const viewport = page.getViewport({ scale })

        canvas!.width = viewport.width
        canvas!.height = viewport.height
        const ctx = canvas!.getContext('2d')
        if (!ctx) throw new Error('Canvas unavailable')

        await page.render({ canvasContext: ctx, viewport }).promise
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load PDF')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    renderPage()
    return () => {
      cancelled = true
    }
  }, [pdfUrl, pageNumber])

  useEffect(() => {
    if (!locateViolation) return
    onSelect(locateViolation.id)
  }, [locateViolation, onSelect])

  return (
    <div className="relative flex h-full flex-col bg-background">
      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-auto p-2">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 text-sm text-text-secondary">
            Loading plan…
          </div>
        )}
        {error && (
          <div className="flex h-full items-center justify-center text-sm text-severity-violation">
            {error}
          </div>
        )}
        <div className="relative mx-auto w-full max-w-full">
          <canvas ref={canvasRef} className="block w-full shadow-md" />
          {!loading && !error && (
            <div className="pointer-events-none absolute inset-0">
              {pins.map((pin) => (
                <button
                  key={pin.id}
                  type="button"
                  style={{ top: `${pin.topPct}%`, right: '4%' }}
                  onClick={() => onSelect(pin.id)}
                  className={clsx(
                    'pointer-events-auto absolute -translate-y-1/2 rounded-full border-2 border-white px-0 shadow-lg transition-transform',
                    'flex h-7 w-7 items-center justify-center text-[11px] font-bold text-white',
                    pin.severity === 'violation' && 'bg-severity-violation',
                    pin.severity === 'warning' && 'bg-severity-warning',
                    pin.severity === 'pass' && 'bg-severity-pass',
                    selectedId === pin.id && 'scale-125 ring-2 ring-accent ring-offset-1',
                    locateViolation?.id === pin.id && 'animate-pulse'
                  )}
                  title={pin.label}
                >
                  {pin.index}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {pageCount > 1 && (
        <div className="flex shrink-0 items-center justify-center gap-3 border-t border-border px-3 py-2 text-xs text-text-secondary">
          <button
            type="button"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            className="rounded border border-border px-2 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {pageNumber} of {pageCount}
          </span>
          <button
            type="button"
            disabled={pageNumber >= pageCount}
            onClick={() => setPageNumber((p) => Math.min(pageCount, p + 1))}
            className="rounded border border-border px-2 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
