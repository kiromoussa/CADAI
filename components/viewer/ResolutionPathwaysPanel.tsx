'use client'

import { useState } from 'react'
import clsx from 'clsx'
import type { ResolutionPathwaysResult } from '@/lib/analysis/resolution-pathways'

interface ResolutionPathwaysPanelProps {
  analysisId: string
  violationId: string
}

export function ResolutionPathwaysPanel({
  analysisId,
  violationId,
}: ResolutionPathwaysPanelProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pathways, setPathways] = useState<ResolutionPathwaysResult | null>(null)

  const loadPathways = async () => {
    if (pathways) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/analyses/${analysisId}/pathways`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ violation_id: violationId }),
      })
      const data = (await res.json()) as {
        pathways?: ResolutionPathwaysResult
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? 'Failed to load pathways')
      setPathways(data.pathways ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pathways')
    } finally {
      setLoading(false)
    }
  }

  if (!pathways && !loading) {
    return (
      <button
        type="button"
        onClick={() => void loadPathways()}
        className="mt-3 rounded-md border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/10"
      >
        View resolution pathways
      </button>
    )
  }

  if (loading) {
    return <p className="mt-3 text-xs text-text-secondary">Generating pathways…</p>
  }

  if (error) {
    return (
      <p className="mt-3 text-xs text-severity-violation">{error}</p>
    )
  }

  if (!pathways) return null

  return (
    <div className="mt-4 space-y-3 border-t border-border/60 pt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
        Resolution pathways
      </p>
      {pathways.pathways.map((p) => (
        <div
          key={p.option}
          className={clsx(
            'rounded-md border p-3 text-sm',
            pathways.recommended_option === p.option
              ? 'border-accent/50 bg-accent/5'
              : 'border-border bg-background/40'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-text-primary">
              Option {p.option}: {p.title}
            </p>
            {pathways.recommended_option === p.option && (
              <span className="shrink-0 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                Recommended
              </span>
            )}
          </div>
          <p className="mt-2 text-text-secondary">{p.action_required}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase text-text-secondary">
            <span>Design: {p.design_impact}</span>
            <span>Cost: {p.cost_impact}</span>
            {p.requires_variance && <span className="text-severity-warning">Variance</span>}
          </div>
        </div>
      ))}
      <p className="text-xs text-text-secondary">{pathways.recommendation_rationale}</p>
    </div>
  )
}
