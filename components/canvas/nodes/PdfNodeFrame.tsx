'use client'

import { useRouter } from 'next/navigation'
import type { CanvasNodeRow } from '@/types/database'
import type { CanvasNodeContent } from '@/types/canvas'

interface PdfNodeFrameProps {
  node: CanvasNodeRow
  pdfUrl: string | null
}

/**
 * Body-only PDF viewer. The surrounding window (CanvasNodeOverlay) supplies the
 * title bar, border and move/resize handles, so this renders just the document.
 * The iframe is always interactive — scroll, zoom and page navigation work as
 * soon as the cursor is inside, no toggle required.
 *
 * When the node has a `linked_analysis_id` it represents a compliance report
 * placed next to its source drawing — render a report card instead of a PDF.
 */
export function PdfNodeFrame({ node, pdfUrl }: PdfNodeFrameProps) {
  const router = useRouter()
  const content = (node.content ?? {}) as CanvasNodeContent & {
    linked_analysis_id?: string
    violation_count?: number
    warning_count?: number
  }
  const isDocument = content.doc_kind === 'document'
  const linkedAnalysisId = content.linked_analysis_id ?? (isDocument && node.analysis_id ? node.analysis_id : null)
  const label =
    content.label ?? content.file_name ?? (isDocument ? 'Document' : 'Floor plan')

  if (linkedAnalysisId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-surface/80 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-severity-pass/20">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-severity-pass" />
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" className="text-severity-pass" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">Compliance Report</p>
          <p className="mt-1 text-xs text-text-secondary">
            Analysis complete
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/viewer/${linkedAnalysisId}`)}
          className="btn-primary px-6 py-2 text-sm"
        >
          Open full report
        </button>
      </div>
    )
  }

  if (!pdfUrl) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-surface/80 p-4 text-center">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        <p className="mt-2 text-xs text-text-secondary">
          {isDocument ? 'Reference document' : 'Drop a PDF to attach'}
        </p>
      </div>
    )
  }

  return (
    <iframe
      title={label}
      src={`${pdfUrl}#view=FitH`}
      className="h-full w-full border-0 bg-white"
    />
  )
}
