'use client'

import { useEffect, useRef } from 'react'
import clsx from 'clsx'

interface CanvasBoardDockProps {
  onAddPdf: (file: File) => void
  onAddDwg: (file: File) => void
  onAddDocument: (file: File) => void
  onAddNote?: () => void
  busy?: boolean
}

export function CanvasBoardDock({
  onAddPdf,
  onAddDwg,
  onAddDocument,
  onAddNote,
  busy,
}: CanvasBoardDockProps) {
  const dockRef = useRef<HTMLDivElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const dwgInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const dock = dockRef.current
    if (!dock) return

    const host = dock.closest('.excalidraw-board-host')
    if (!host) return

    const position = () => {
      const toolbar = host.querySelector('.App-toolbar')
      if (!toolbar || !dock) return
      const toolbarRect = toolbar.getBoundingClientRect()
      const hostRect = host.getBoundingClientRect()
      dock.style.left = `${toolbarRect.right - hostRect.left + 8}px`
      dock.style.bottom = `${hostRect.bottom - toolbarRect.bottom}px`
      dock.style.visibility = 'visible'
    }

    position()

    const resizeObserver = new ResizeObserver(position)
    const mutationObserver = new MutationObserver(() => {
      position()
      const toolbar = host.querySelector('.App-toolbar')
      if (toolbar) resizeObserver.observe(toolbar)
    })

    mutationObserver.observe(host, { childList: true, subtree: true })

    const toolbar = host.querySelector('.App-toolbar')
    if (toolbar) resizeObserver.observe(toolbar)

    window.addEventListener('resize', position)

    return () => {
      mutationObserver.disconnect()
      resizeObserver.disconnect()
      window.removeEventListener('resize', position)
    }
  }, [])

  return (
    <div
      ref={dockRef}
      className="canvas-board-dock pointer-events-auto absolute z-[4] flex items-center gap-0.5 rounded-lg border border-[var(--default-border-color,#3d3d3d)] bg-[var(--island-bg-color,#232329)] p-1 shadow-sm invisible"
      aria-label="Plan import tools"
    >
      <DockButton
        label="Add plan PDF"
        title="Add building-plan PDF (runs code compliance)"
        disabled={busy}
        onClick={() => pdfInputRef.current?.click()}
      >
        <PdfIcon />
      </DockButton>
      <DockButton
        label="Add DWG"
        title="Add CAD / DWG plan"
        disabled={busy}
        onClick={() => dwgInputRef.current?.click()}
      >
        <DwgIcon />
      </DockButton>
      <DockButton
        label="Add document"
        title="Add a normal PDF (reference only, not analyzed)"
        disabled={busy}
        onClick={() => docInputRef.current?.click()}
      >
        <DocumentIcon />
      </DockButton>
      {onAddNote && (
        <DockButton
          label="Add note"
          title="Add a sticky note for comments and checklists"
          disabled={busy}
          onClick={onAddNote}
        >
          <NoteIcon />
        </DockButton>
      )}
      <input
        ref={docInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onAddDocument(file)
          e.target.value = ''
        }}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onAddPdf(file)
          e.target.value = ''
        }}
      />
      <input
        ref={dwgInputRef}
        type="file"
        accept=".dwg,.dxf,.rvt,.ifc,.nwd,.nwc,application/vnd.autodesk.autocad.dwg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onAddDwg(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function DockButton({
  label,
  title,
  disabled,
  onClick,
  children,
}: {
  label: string
  title: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'flex h-9 w-9 items-center justify-center rounded-md text-[var(--icon-fill-color,#e0e0e0)] transition',
        'hover:bg-[var(--button-hover-bg,#2f2f37)] disabled:cursor-not-allowed disabled:opacity-40'
      )}
    >
      {children}
    </button>
  )
}

function PdfIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 12h8M8 16h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M14 3v4h4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 11h8M8 14h8M8 17h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function NoteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 4h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M15 4v3h3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 12h8M8 15h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function DwgIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M14 5v5h5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 14 10.5 18 13 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
