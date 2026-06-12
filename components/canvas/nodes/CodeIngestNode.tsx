'use client'

import type { CanvasNodeRow } from '@/types/database'

interface CodeIngestNodeProps {
  node: CanvasNodeRow
  jobStatus?: string
}

export function CodeIngestNode({ node, jobStatus }: CodeIngestNodeProps) {
  const content = node.content as { jurisdiction?: string; file_name?: string }

  return (
    <div className="flex h-full flex-col items-center justify-center rounded border border-dashed border-amber-500/40 bg-surface/90 p-4 text-center">
      <p className="text-sm font-medium text-text-primary">Code ingest</p>
      <p className="mt-1 text-xs text-text-secondary">
        {content.jurisdiction ?? content.file_name ?? 'Municipal code PDF'}
      </p>
      {jobStatus && (
        <p className="mt-2 rounded bg-amber-500/10 px-2 py-0.5 text-xs capitalize text-amber-400">
          {jobStatus}
        </p>
      )}
    </div>
  )
}
