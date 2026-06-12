'use client'

import Link from 'next/link'

interface CanvasToolbarProps {
  boardTitle: string
  onTitleChange: (title: string) => void
  onRunCompliance: (nodeId: string) => void
  selectedNodeId: string | null
  canRunCompliance?: boolean
  analyzing: boolean
  progressMessage: string
  toolsOpen?: boolean
  onToggleTools?: () => void
  exportAnalysisId?: string | null
}

export function CanvasToolbar({
  boardTitle,
  onTitleChange,
  onRunCompliance,
  selectedNodeId,
  canRunCompliance = true,
  analyzing,
  progressMessage,
  toolsOpen,
  onToggleTools,
  exportAnalysisId,
}: CanvasToolbarProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3">
      <Link href="/dashboard" className="text-xs text-accent hover:underline">
        ← Dashboard
      </Link>
      <input
        type="text"
        value={boardTitle}
        onChange={(e) => onTitleChange(e.target.value)}
        className="min-w-[200px] flex-1 rounded border border-border bg-background px-2 py-1 text-sm text-text-primary"
        aria-label="Board title"
      />
      <button
        type="button"
        disabled={!selectedNodeId || !canRunCompliance || analyzing}
        onClick={() => selectedNodeId && onRunCompliance(selectedNodeId)}
        className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-40"
      >
        {analyzing ? 'Running…' : 'Run compliance'}
      </button>
      {onToggleTools && (
        <button
          type="button"
          onClick={onToggleTools}
          className={
            'rounded border px-3 py-1.5 text-sm transition ' +
            (toolsOpen
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border text-text-primary hover:border-accent')
          }
        >
          Board tools
        </button>
      )}
      {exportAnalysisId && (
        <a
          href={`/api/analyses/${exportAnalysisId}/report`}
          className="rounded border border-border px-3 py-1.5 text-sm text-text-primary transition hover:border-accent hover:text-accent"
        >
          Export report
        </a>
      )}
      {progressMessage && (
        <span className="text-xs text-text-secondary">{progressMessage}</span>
      )}
    </header>
  )
}
