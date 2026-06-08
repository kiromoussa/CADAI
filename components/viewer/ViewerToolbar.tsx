'use client'

import type { ReactNode } from 'react'

interface ViewerToolbarProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onHome: () => void
  sheetLabel?: string
  disabled?: boolean
}

export function ViewerToolbar({
  onZoomIn,
  onZoomOut,
  onFit,
  onHome,
  sheetLabel,
  disabled = false,
}: ViewerToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-[#2d2d30] bg-[#1a1a1a] px-3 py-2">
      <div className="flex items-center gap-1">
        <ToolbarButton label="Zoom in" onClick={onZoomIn} disabled={disabled}>
          +
        </ToolbarButton>
        <ToolbarButton label="Zoom out" onClick={onZoomOut} disabled={disabled}>
          −
        </ToolbarButton>
        <ToolbarButton label="Fit to view" onClick={onFit} disabled={disabled}>
          Fit
        </ToolbarButton>
        <ToolbarButton label="Home view" onClick={onHome} disabled={disabled}>
          Home
        </ToolbarButton>
      </div>
      {sheetLabel && (
        <p className="truncate text-[10px] text-[#9ca3af]">{sheetLabel}</p>
      )}
    </div>
  )
}

function ToolbarButton({
  children,
  label,
  onClick,
  disabled = false,
}: {
  children: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-[#3c3c3c] bg-[#252526] px-2.5 py-1 text-xs font-medium text-[#e5e7eb] transition hover:border-[#0078d4] hover:bg-[#2d2d30] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}
