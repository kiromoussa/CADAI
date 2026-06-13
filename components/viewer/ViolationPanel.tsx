'use client'

import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { disciplineLabel } from '@/lib/analysis/disciplines'
import type { Discipline } from '@/types/analysis'
import type { ViolationRow } from '@/types/database'
import { ResolutionCard } from '@/components/viewer/ResolutionCard'

export type SeverityFilter = 'all' | 'violation' | 'warning' | 'pass'

interface ViolationPanelProps {
  violations: ViolationRow[]
  selectedId: string | null
  activeSheetGuid?: string | null
  analysisId?: string
  onSelect: (id: string) => void
  onLocate: (violation: ViolationRow) => void
  onViolationUpdate?: (violation: ViolationRow) => void
}

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

function disciplineOf(v: ViolationRow): Discipline {
  const d = v.discipline as Discipline | null
  if (d && DISCIPLINE_ORDER.includes(d)) return d
  return 'general'
}

export function ViolationPanel({
  violations,
  selectedId,
  activeSheetGuid,
  analysisId,
  onSelect,
  onLocate,
  onViolationUpdate,
}: ViolationPanelProps) {
  const [filter, setFilter] = useState<SeverityFilter>('all')
  const [collapsedDisciplines, setCollapsedDisciplines] = useState<Set<string>>(new Set())

  const counts = useMemo(
    () => ({
      violation: violations.filter((v) => v.severity === 'violation').length,
      warning: violations.filter((v) => v.severity === 'warning').length,
      pass: violations.filter((v) => v.severity === 'pass').length,
      accepted: violations.filter((v) => v.accepted_pathway != null).length,
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
        <h2 className="text-sm font-semibold text-text-primary">Resolution plan</h2>
        <p className="mt-0.5 text-xs text-text-secondary">
          {counts.accepted} accepted · accept resolutions, then re-run for a new FirstPass score
        </p>
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
                      {items.map((violation, index) => (
                        <li key={violation.id}>
                          {analysisId ? (
                            <ResolutionCard
                              violation={violation}
                              index={index}
                              analysisId={analysisId}
                              selected={selectedId === violation.id}
                              onSelect={() => onSelect(violation.id)}
                              onLocate={() => onLocate(violation)}
                              onAccepted={onViolationUpdate}
                            />
                          ) : null}
                        </li>
                      ))}
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
