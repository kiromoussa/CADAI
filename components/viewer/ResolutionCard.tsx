'use client'

import { useState } from 'react'
import clsx from 'clsx'
import type { ResolutionPathwaySummary } from '@/types/analysis'
import type { ViolationRow } from '@/types/database'
import {
  getRecommendedPathway,
  parsePathways,
} from '@/lib/analysis/approval-plan'

interface ResolutionCardProps {
  violation: ViolationRow
  index: number
  analysisId: string
  selected: boolean
  onSelect: () => void
  onLocate: () => void
  onAccepted?: (violation: ViolationRow) => void
}

const severityStyles = {
  violation: {
    border: 'border-severity-violation/40',
    bg: 'bg-severity-violation/10',
    text: 'text-severity-violation',
    dot: 'bg-severity-violation',
  },
  warning: {
    border: 'border-severity-warning/40',
    bg: 'bg-severity-warning/10',
    text: 'text-severity-warning',
    dot: 'bg-severity-warning',
  },
  pass: {
    border: 'border-severity-pass/40',
    bg: 'bg-severity-pass/10',
    text: 'text-severity-pass',
    dot: 'bg-severity-pass',
  },
} as const

export function ResolutionCard({
  violation,
  index,
  analysisId,
  selected,
  onSelect,
  onLocate,
  onAccepted,
}: ResolutionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [accepting, setAccepting] = useState(false)

  const styles =
    severityStyles[violation.severity as keyof typeof severityStyles] ??
    severityStyles.warning

  const pathways = parsePathways(violation.resolution_pathways)
  const recommended = getRecommendedPathway(violation)
  const accepted = violation.accepted_pathway as ResolutionPathwaySummary | null
  const isPass = violation.severity === 'pass'

  const acceptPathway = async (option: number) => {
    setAccepting(true)
    try {
      const res = await fetch(
        `/api/analyses/${analysisId}/violations/${violation.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pathway_option: option }),
        }
      )
      const data = (await res.json()) as { violation?: ViolationRow }
      if (res.ok && data.violation) onAccepted?.(data.violation)
    } finally {
      setAccepting(false)
    }
  }

  return (
    <article
      className={clsx(
        'rounded-lg border p-3 transition duration-200',
        styles.border,
        selected ? 'ring-2 ring-accent/60' : 'hover:border-accent/30',
        accepted && 'border-severity-pass/50'
      )}
    >
      <button type="button" className="w-full text-left" onClick={onSelect}>
        <div className="flex items-start gap-3">
          <span
            className={clsx(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-background',
              accepted ? 'bg-severity-pass' : styles.dot
            )}
          >
            {accepted ? '✓' : index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={clsx(
                  'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  styles.bg,
                  styles.text
                )}
              >
                {violation.severity}
              </span>
              {violation.requires_manual_review && (
                <span className="text-[10px] font-medium text-severity-warning">
                  Manual review
                </span>
              )}
              {accepted && (
                <span className="text-[10px] font-medium text-severity-pass">
                  Accepted
                </span>
              )}
            </div>
            <p className="mt-1 font-mono text-xs text-accent">{violation.code_section}</p>
            <p className="text-sm font-medium text-text-primary">{violation.code_title}</p>
            <p className="mt-1 text-sm text-text-secondary">{violation.finding}</p>
          </div>
        </div>
      </button>

      {!isPass && (
        <div className="mt-3 border-t border-border/50 pt-3 pl-9">
          {violation.requires_manual_review && pathways.length === 0 ? (
            <p className="text-sm text-severity-warning">
              No automated pathway — escalate to licensed reviewer or AHJ.
            </p>
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">
                Recommended resolution
              </p>
              <p className="mt-1 text-sm font-medium text-text-primary">
                {recommended?.title ?? 'Recommended fix'}
              </p>
              <p className="mt-1 text-sm text-text-primary">
                {accepted?.action_required ??
                  recommended?.action_required ??
                  violation.recommended_action ??
                  violation.recommendation}
              </p>
              {(recommended || pathways.length > 0) && (
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase text-text-secondary">
                  {recommended && (
                    <>
                      <span>Design: {recommended.design_impact}</span>
                      <span>Cost: {recommended.cost_impact}</span>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {!accepted && recommended && !violation.requires_manual_review && (
              <button
                type="button"
                disabled={accepting}
                onClick={() => void acceptPathway(recommended.option)}
                className="rounded-md bg-severity-pass px-3 py-1.5 text-xs font-medium text-white hover:bg-severity-pass/90 disabled:opacity-50"
              >
                {accepting ? 'Saving…' : 'Accept resolution'}
              </button>
            )}
            <button
              type="button"
              onClick={onLocate}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-text-primary hover:border-accent"
            >
              Locate on plan
            </button>
            {pathways.length > 1 && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary"
              >
                {expanded ? 'Hide' : 'All'} pathways ({pathways.length})
              </button>
            )}
          </div>

          {expanded && pathways.length > 0 && (
            <div className="mt-3 space-y-2">
              {pathways.map((p) => (
                <div
                  key={p.option}
                  className={clsx(
                    'rounded border p-2 text-xs',
                    p.option === violation.recommended_pathway
                      ? 'border-accent/40 bg-accent/5'
                      : 'border-border'
                  )}
                >
                  <p className="font-medium text-text-primary">
                    Option {p.option}: {p.title}
                  </p>
                  <p className="mt-1 text-text-secondary">{p.action_required}</p>
                  {!accepted && (
                    <button
                      type="button"
                      disabled={accepting}
                      onClick={() => void acceptPathway(p.option)}
                      className="mt-2 text-accent hover:underline disabled:opacity-50"
                    >
                      Accept this option
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  )
}
