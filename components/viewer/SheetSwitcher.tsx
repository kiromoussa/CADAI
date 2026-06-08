'use client'

import clsx from 'clsx'
import { disciplineLabel } from '@/lib/analysis/disciplines'
import type { Discipline } from '@/types/analysis'

export interface ViewerSheet {
  guid: string
  name: string
  discipline: Discipline
  violationCount?: number
}

interface SheetSwitcherProps {
  sheets: ViewerSheet[]
  activeGuid: string | null
  onChange: (guid: string) => void
  loading?: boolean
}

export function SheetSwitcher({
  sheets,
  activeGuid,
  onChange,
  loading,
}: SheetSwitcherProps) {
  if (sheets.length <= 1) return null

  return (
    <div className="flex items-center gap-2 border-b border-[#2d2d30] bg-[#1a1a1a] px-3 py-2">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">
        Sheet
      </span>
      <select
        value={activeGuid ?? ''}
        disabled={loading || sheets.length === 0}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 rounded border border-[#3c3c3c] bg-[#252526] px-2 py-1.5 text-xs text-[#e5e7eb] outline-none focus:border-[#0078d4]"
      >
        {sheets.map((sheet) => (
          <option key={sheet.guid} value={sheet.guid}>
            {sheet.name} — {disciplineLabel(sheet.discipline)}
            {sheet.violationCount != null && sheet.violationCount > 0
              ? ` (${sheet.violationCount})`
              : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

export function SheetList({
  sheets,
  activeGuid,
  onChange,
}: {
  sheets: ViewerSheet[]
  activeGuid: string | null
  onChange: (guid: string) => void
}) {
  if (sheets.length <= 1) return null

  return (
    <ul className="max-h-32 overflow-y-auto border-b border-[#2d2d30] bg-[#1a1a1a] px-2 py-1">
      {sheets.map((sheet) => (
        <li key={sheet.guid}>
          <button
            type="button"
            onClick={() => onChange(sheet.guid)}
            className={clsx(
              'flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition',
              activeGuid === sheet.guid
                ? 'bg-[#0078d4]/20 text-[#60a5fa]'
                : 'text-[#d1d5db] hover:bg-[#2d2d30]'
            )}
          >
            <span className="truncate">{sheet.name}</span>
            <span className="ml-2 shrink-0 text-[10px] text-[#9ca3af]">
              {disciplineLabel(sheet.discipline)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
