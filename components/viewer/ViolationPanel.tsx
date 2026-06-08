'use client'

import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { disciplineLabel } from '@/lib/analysis/disciplines'
import type { Discipline } from '@/types/analysis'
import type { ViolationRow } from '@/types/database'

export type SeverityFilter = 'all' | 'violation' | 'warning' | 'pass'

interface ViolationPanelProps {
  violations: ViolationRow[]
  selectedId: string | null
  activeSheetGuid?: string | null
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

const DISCIPLINE_ORDER: Discipline[] = [
  'architectural',
  'structural',
  'roof',
  'electrical',
  'plumbing',
  'mechanical',
  'fire',
  'general',
]

function severityLabel(severity: string) {
  if (severity === 'violation') return 'Violation'
  if (severity === 'warning') return 'Warning'
  return 'Pass'
}

function disciplineOf(v: ViolationRow): Discipline {
  const d = v.discipline as Discipline | null
  if (d && DISCIPLINE_ORDER.includes(d)) return d
  return 'general'
}

export function ViolationPanel({
  violations,
  selectedId,
  activeSheetGuid,
  onSelect,
  onLocate,
}: ViolationPanelProps) {
  const [filter, setFilter] = useState<SeverityFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [collapsedDisciplines, setCollapsedDisciplines] = useState<Set<string>>(new Set())

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

  const grouped = useMemo(() => {
    const map = new Map<Discipline, ViolationRow[]>()
    for (const v of filtered) {
      const d = disciplineOf(v)
      const list = map.get(d) ?? []
      list.push(v)
      map.set(d, list)
    }

    return DISCIPLINE_ORDER.filter((d) => map.has(d)).map((d) => ({
      discipline: d,
      items: map.get(d)!,
    }))
  }, [filtered])

  const tabs: Array<{ key: SeverityFilter; label: string; count: number }> = [
    { key: 'all', label: 'All', count: violations.length },
    { key: 'violation', label: 'Violations', count: counts.violation },
    { key: 'warning', label: 'Warnings', count: counts.warning },
    { key: 'pass', label: 'Passed', count: counts.pass },
  ]

  const toggleDiscipline = (d: string) => {
    setCollapsedDisciplines((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-4">
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
              'whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition duration-200 ease-out',
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
          <div className="space-y-4">
            {grouped.map(({ discipline, items }) => {
              const collapsed = collapsedDisciplines.has(discipline)
              const discViolations = items.filter((v) => v.severity === 'violation').length
              const discWarnings = items.filter((v) => v.severity === 'warning').length

              return (
                <section key={discipline}>
                  <button
                    type="button"
                    onClick={() => toggleDiscipline(discipline)}
                    className="flex w-full items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2 text-left transition duration-200 hover:border-accent/30"
                  >
                    <span className="text-sm font-medium text-text-primary">
                      {disciplineLabel(discipline)}
                    </span>
                    <span className="flex items-center gap-2">
                      {discViolations > 0 && (
                        <span className="rounded-full bg-severity-violation/20 px-2 py-0.5 text-[10px] font-semibold text-severity-violation">
                          {discViolations}
                        </span>
                      )}
                      {discWarnings > 0 && (
                        <span className="rounded-full bg-severity-warning/20 px-2 py-0.5 text-[10px] font-semibold text-severity-warning">
                          {discWarnings}
                        </span>
                      )}
                      <span className="text-xs text-text-secondary">
                        {collapsed ? '▸' : '▾'}
                      </span>
                    </span>
                  </button>

                  {!collapsed && (
                    <ul className="mt-2 space-y-3 transition-all duration-200 ease-out">
                      {items.map((violation, index) => {
                        const styles =
                          severityStyles[
                            violation.severity as keyof typeof severityStyles
                          ] ?? severityStyles.warning
                        const isSelected = selectedId === violation.id
                        const isExpanded = expandedId === violation.id
                        const onOtherSheet =
                          !!activeSheetGuid &&
                          !!violation.sheet_guid &&
                          violation.sheet_guid !== activeSheetGuid

                        return (
                          <li key={violation.id}>
                            <article
                              className={clsx(
                                'rounded-lg border p-3 transition duration-200 ease-out',
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
                                    <div className="flex flex-wrap items-center gap-2">
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
                                      {onOtherSheet && (
                                        <span className="text-[10px] text-text-secondary">
                                          Other sheet
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
                                    {(violation.measured_value ||
                                      violation.required_value) && (
                                      <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs">
                                        {violation.measured_value && (
                                          <div className="rounded bg-background/60 px-2 py-1">
                                            <span className="text-text-secondary">
                                              Measured{' '}
                                            </span>
                                            <span className="text-text-primary">
                                              {violation.measured_value}
                                            </span>
                                          </div>
                                        )}
                                        {violation.required_value && (
                                          <div className="rounded bg-background/60 px-2 py-1">
                                            <span className="text-text-secondary">
                                              Required{' '}
                                            </span>
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
                                  <div className="relative mt-3 inline-block">
                                    <button
                                      type="button"
                                      onClick={() => onLocate(violation)}
                                      title={
                                        onOtherSheet
                                          ? 'Switch to that sheet and zoom to the finding'
                                          : violation.element_id
                                            ? 'Zoom to element on plan'
                                            : violation.sheet_guid
                                              ? 'Switch sheet and fit plan to view'
                                              : 'Fit current sheet to view'
                                      }
                                      className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition duration-200 hover:bg-accent/90"
                                    >
                                      Locate on plan
                                    </button>
                                  </div>
                                </div>
                              )}
                            </article>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              )
            })}
          </div>
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
    <div className="rounded-md border border-border bg-background/40 px-2 py-2 text-center transition duration-200">
      <p className={clsx('font-mono text-lg font-semibold', toneClass)}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-text-secondary">{label}</p>
    </div>
  )
}
