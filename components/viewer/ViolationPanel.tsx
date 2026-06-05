'use client'

import { useMemo, useState } from 'react'
import clsx from 'clsx'
import type { ViolationRow } from '@/types/database'

export type SeverityFilter = 'all' | 'violation' | 'warning' | 'pass'

interface ViolationPanelProps {
  violations: ViolationRow[]
  selectedId: string | null
  onSelect: (id: string) => void
  onLocate: (violation: ViolationRow) => void
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

function severityLabel(severity: string) {
  if (severity === 'violation') return 'Violation'
  if (severity === 'warning') return 'Warning'
  return 'Pass'
}

export function ViolationPanel({
  violations,
  selectedId,
  onSelect,
  onLocate,
}: ViolationPanelProps) {
  const [filter, setFilter] = useState<SeverityFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const counts = useMemo(
    () => ({
      violation: violations.filter((v) => v.severity === 'violation').length,
      warning: violations.filter((v) => v.severity === 'warning').length,
      pass: violations.filter((v) => v.severity === 'pass').length,
    }),
    [violations]
  )

  const filtered = useMemo(() => {
    if (filter === 'all') return violations
    return violations.filter((v) => v.severity === filter)
  }, [filter, violations])

  const tabs: Array<{ key: SeverityFilter; label: string; count: number }> = [
    { key: 'all', label: 'All', count: violations.length },
    { key: 'violation', label: 'Violations', count: counts.violation },
    { key: 'warning', label: 'Warnings', count: counts.warning },
    { key: 'pass', label: 'Passed', count: counts.pass },
  ]

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="border-b border-border px-4 py-4">
        <h2 className="text-sm font-semibold text-text-primary">Compliance Report</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <SummaryPill label="Violations" value={counts.violation} tone="violation" />
          <SummaryPill label="Warnings" value={counts.warning} tone="warning" />
          <SummaryPill label="Passed" value={counts.pass} tone="pass" />
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={clsx(
              'whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition',
              filter === tab.key
                ? 'bg-accent/20 text-accent'
                : 'text-text-secondary hover:bg-border/50 hover:text-text-primary'
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {filtered.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-text-secondary">
            No findings in this category.
          </p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((violation, index) => {
              const styles =
                severityStyles[violation.severity as keyof typeof severityStyles] ??
                severityStyles.warning
              const isSelected = selectedId === violation.id
              const isExpanded = expandedId === violation.id

              return (
                <li key={violation.id}>
                  <article
                    className={clsx(
                      'rounded-lg border p-3 transition',
                      styles.border,
                      isSelected ? 'ring-2 ring-accent/60' : 'hover:border-accent/30'
                    )}
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => {
                        onSelect(violation.id)
                        setExpandedId(isExpanded ? null : violation.id)
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={clsx(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-background',
                            styles.dot
                          )}
                        >
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={clsx(
                                'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                                styles.bg,
                                styles.text
                              )}
                            >
                              {severityLabel(violation.severity)}
                            </span>
                            {violation.confidence && (
                              <span className="text-[10px] uppercase text-text-secondary">
                                {violation.confidence} confidence
                              </span>
                            )}
                          </div>
                          <p className="mt-1 font-mono text-xs text-accent">
                            {violation.code_section}
                          </p>
                          <p className="mt-0.5 text-sm font-medium text-text-primary">
                            {violation.code_title}
                          </p>
                          <p className="mt-2 text-sm text-text-secondary line-clamp-2">
                            {violation.finding}
                          </p>
                          {(violation.measured_value || violation.required_value) && (
                            <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs">
                              {violation.measured_value && (
                                <div className="rounded bg-background/60 px-2 py-1">
                                  <span className="text-text-secondary">Measured </span>
                                  <span className="text-text-primary">
                                    {violation.measured_value}
                                  </span>
                                </div>
                              )}
                              {violation.required_value && (
                                <div className="rounded bg-background/60 px-2 py-1">
                                  <span className="text-text-secondary">Required </span>
                                  <span className="text-text-primary">
                                    {violation.required_value}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-3 border-t border-border/60 pt-3 pl-9">
                        <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                          Code requirement
                        </p>
                        <p className="mt-1 text-sm text-text-primary">
                          {violation.code_requirement}
                        </p>
                        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-text-secondary">
                          Recommendation
                        </p>
                        <p className="mt-1 text-sm text-text-primary">
                          {violation.recommendation}
                        </p>
                        {violation.element_location && (
                          <p className="mt-2 font-mono text-xs text-text-secondary">
                            {violation.element_location}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => onLocate(violation)}
                          className="mt-3 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent/90"
                        >
                          Locate on plan
                        </button>
                      </div>
                    )}
                  </article>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'violation' | 'warning' | 'pass'
}) {
  const toneClass = {
    violation: 'text-severity-violation',
    warning: 'text-severity-warning',
    pass: 'text-severity-pass',
  }[tone]

  return (
    <div className="rounded-md border border-border bg-background/40 px-2 py-2 text-center">
      <p className={clsx('font-mono text-lg font-semibold', toneClass)}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-text-secondary">{label}</p>
    </div>
  )
}
