'use client'

import type { CanvasNodeRow } from '@/types/database'
import type { CanvasNodeContent } from '@/types/canvas'

/** Live progress for a CAD node while it uploads / translates on Autodesk. */
export interface ForgeNodeProgress {
  stage: 'uploading' | 'translating' | 'error'
  message: string
}

interface ForgeNodeFrameProps {
  node: CanvasNodeRow
  urn: string | null
  progress?: ForgeNodeProgress
}

const FORGE_STEPS = [
  { id: 'upload' as const, label: 'Upload' },
  { id: 'translate' as const, label: 'Translate' },
  { id: 'preview' as const, label: 'Preview' },
]

type ForgeStage = 'upload' | 'translate' | 'preview'

function ForgeStepper({ active }: { active: ForgeStage }) {
  const activeIndex = FORGE_STEPS.findIndex((s) => s.id === active)
  return (
    <ol className="flex w-full max-w-xs items-center justify-between gap-1">
      {FORGE_STEPS.map((step, i) => {
        const done = i < activeIndex
        const current = i === activeIndex
        return (
          <li key={step.id} className="flex flex-1 flex-col items-center">
            <span
              className={
                'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition ' +
                (done
                  ? 'bg-severity-pass/20 text-severity-pass'
                  : current
                    ? 'bg-accent/20 text-accent ring-2 ring-accent/40'
                    : 'bg-border/50 text-text-secondary')
              }
            >
              {done ? '✓' : i + 1}
            </span>
            <span
              className={
                'mt-1 text-center text-[10px] font-medium ' +
                (current ? 'text-accent' : 'text-text-secondary')
              }
            >
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** Busy state: shows the translation pipeline + live status message. */
function ForgeBusy({
  label,
  message,
  stage,
}: {
  label: string
  message: string
  stage: ForgeStage
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-surface/80 p-4 text-center">
      <p className="text-sm font-medium text-text-primary">{label}</p>
      <ForgeStepper active={stage} />
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <span className="max-w-[16rem] truncate">{message}</span>
      </div>
    </div>
  )
}

/** Error state: translation failed — surfaced inside the resizable window. */
function ForgeError({ label, message }: { label: string; message: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-surface/80 p-4 text-center">
      <p className="text-sm font-medium text-text-primary">{label}</p>
      <div className="max-h-full w-full overflow-auto rounded-lg border border-red-500/40 bg-background p-3">
        <p className="text-xs text-red-300">{message}</p>
      </div>
      <p className="text-[11px] text-text-secondary">
        Re-upload the DWG to refresh the translation.
      </p>
    </div>
  )
}

/**
 * Body-only APS viewer. The surrounding window (CanvasNodeOverlay) supplies the
 * title bar, border and move/resize handles. While the drawing uploads and
 * translates, the body shows the same step tracker as the standalone analyzer —
 * the viewer only mounts once a translated URN is ready.
 */
export function ForgeNodeFrame({ node, urn, progress }: ForgeNodeFrameProps) {
  const content = (node.content ?? {}) as CanvasNodeContent
  const label = content.label ?? content.file_name ?? 'CAD model'

  // Live error takes priority — keep the failure visible in the window.
  if (progress?.stage === 'error') {
    return <ForgeError label={label} message={progress.message} />
  }

  // Not ready to view yet: render the pipeline. ANY live progress (uploading or
  // translating) keeps the step tracker up — the URN can resolve before
  // translation finishes, so we must not mount the viewer until progress clears.
  // Falls back to the persisted upload_status after a reload mid-translate.
  const uploadPending =
    content.upload_status === 'uploading' || content.upload_status === 'translating'
  const ready = Boolean(urn) && !progress && !uploadPending
  if (!ready) {
    const stage: ForgeStage =
      progress?.stage === 'translating' || content.upload_status === 'translating'
        ? 'translate'
        : 'upload'
    const message =
      progress?.message ??
      (stage === 'translate'
        ? 'Translating drawing for preview…'
        : 'Uploading drawing to Autodesk…')
    return <ForgeBusy label={label} message={message} stage={stage} />
  }

  if (!urn) {
    return <ForgeBusy label={label} message="Preparing preview…" stage="translate" />
  }

  // Same isolation pattern as PdfNodeFrame: a plain iframe in the overlay body.
  // PdfNodeFrame mounts immediately (no ResizeObserver gate) — the overlay window
  // already supplies fixed pixel width/height, which is enough for the browser PDF
  // plugin. CAD uses the same shell; only the iframe src differs (Forge embed route
  // instead of a signed Supabase PDF URL).
  return (
    <iframe
      title={label}
      src={`/embed/forge?urn=${encodeURIComponent(urn)}`}
      className="h-full w-full border-0 bg-[#1e1e1e]"
      allow="fullscreen"
    />
  )
}
