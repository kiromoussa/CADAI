'use client'

import { useMemo } from 'react'
import clsx from 'clsx'
import type { ReadinessResult } from '@/lib/analysis/readiness'

interface ReadinessBannerProps {
  readiness: ReadinessResult
  compact?: boolean
}

const toneStyles = {
  'Ready to Submit': {
    bar: 'bg-severity-pass',
    text: 'text-severity-pass',
    bg: 'bg-severity-pass/10 border-severity-pass/30',
  },
  'Submit with Caution': {
    bar: 'bg-severity-warning',
    text: 'text-severity-warning',
    bg: 'bg-severity-warning/10 border-severity-warning/30',
  },
  'Not Ready': {
    bar: 'bg-severity-violation',
    text: 'text-severity-violation',
    bg: 'bg-severity-violation/10 border-severity-violation/30',
  },
} as const

export function ReadinessBanner({ readiness, compact }: ReadinessBannerProps) {
  const styles = toneStyles[readiness.recommendation]
  const scorePercent = useMemo(
    () => Math.min(100, Math.max(0, readiness.readiness_score)),
    [readiness.readiness_score]
  )

  if (compact) {
    return (
      <div className={clsx('rounded-md border px-3 py-2', styles.bg)}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-text-primary">Readiness</span>
          <span className={clsx('font-mono text-sm font-semibold', styles.text)}>
            {scorePercent}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background/60">
          <div
            className={clsx('h-full rounded-full transition-all', styles.bar)}
            style={{ width: `${scorePercent}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('rounded-lg border px-4 py-3', styles.bg)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            FirstPass readiness score
          </p>
          <p className={clsx('mt-1 text-2xl font-semibold', styles.text)}>
            {scorePercent}
            <span className="text-base font-normal text-text-secondary"> / 100</span>
          </p>
          <p className={clsx('mt-1 text-sm font-medium', styles.text)}>
            {readiness.recommendation}
          </p>
        </div>
        <div className="text-right text-xs text-text-secondary">
          <p>{readiness.critical} critical</p>
          <p>{readiness.major} major</p>
          <p>{readiness.minor} minor</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-background/60">
        <div
          className={clsx('h-full rounded-full transition-all', styles.bar)}
          style={{ width: `${scorePercent}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-text-primary">{readiness.summary_for_client}</p>
      {readiness.top_ahj_flags.length > 0 && (
        <div className="mt-3 border-t border-border/50 pt-3">
          <p className="text-xs font-medium uppercase text-text-secondary">
            Top AHJ flags
          </p>
          <ol className="mt-2 space-y-1.5 text-sm text-text-primary">
            {readiness.top_ahj_flags.slice(0, 3).map((f) => (
              <li key={f.rank}>
                <span className="font-mono text-xs text-accent">{f.code_citation}</span>
                {' — '}
                {f.issue.slice(0, 100)}
                {f.issue.length > 100 ? '…' : ''}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
