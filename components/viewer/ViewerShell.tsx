'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { disciplineLabel } from '@/lib/analysis/disciplines'
import type { AnalysisRow, ProjectRow, ViolationRow } from '@/types/database'
import { ViolationPanel } from '@/components/viewer/ViolationPanel'
import type { ViewerSheet } from '@/components/viewer/SheetSwitcher'

function ViewerLoading({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[#1e1e1e]">
      <div className="h-8 w-48 animate-pulse rounded bg-[#2d2d30]" />
      <p className="mt-4 text-sm text-[#9ca3af]">{message}</p>
    </div>
  )
}

const ForgeViewer = dynamic(
  () => import('@/components/viewer/ForgeViewer').then((m) => m.ForgeViewer),
  {
    ssr: false,
    loading: () => <ViewerLoading message="Loading drawing…" />,
  }
)

const PdfViewer = dynamic(
  () => import('@/components/viewer/PdfViewer').then((m) => m.PdfViewer),
  {
    ssr: false,
    loading: () => <ViewerLoading message="Loading PDF…" />,
  }
)

interface ViewerShellProps {
  analysis: AnalysisRow
  project: ProjectRow
  violations: ViolationRow[]
  pdfUrl: string | null
}

export function ViewerShell({
  analysis,
  project,
  violations,
  pdfUrl,
}: ViewerShellProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    violations.find((v) => v.severity === 'violation')?.id ?? violations[0]?.id ?? null
  )
  const [locateViolation, setLocateViolation] = useState<ViolationRow | null>(null)
  const [activeSheet, setActiveSheet] = useState<ViewerSheet | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const handleLocate = useCallback((violation: ViolationRow) => {
    setSelectedId(violation.id)
    setLocateViolation(violation)
  }, [])

  const handleSheetChange = useCallback(
    (sheet: ViewerSheet) => {
      setActiveSheet(sheet)
      const onSheet = violations.filter(
        (v) => !v.sheet_guid || v.sheet_guid === sheet.guid
      )
      const issueCount = onSheet.filter(
        (v) => v.severity === 'violation' || v.severity === 'warning'
      ).length
      const label = disciplineLabel(sheet.discipline)
      setToast(
        issueCount > 0
          ? `Showing ${label} — ${sheet.name} (${issueCount} finding${issueCount === 1 ? '' : 's'} on this sheet)`
          : `Showing ${label} — ${sheet.name}`
      )
    },
    [violations]
  )

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const isAps = analysis.source_type === 'aps' && project.aps_urn

  const activeSheetGuid = activeSheet?.guid ?? null

  const sheetViolationCount = useMemo(() => {
    if (!activeSheetGuid) return 0
    return violations.filter(
      (v) =>
        (!v.sheet_guid || v.sheet_guid === activeSheetGuid) &&
        (v.severity === 'violation' || v.severity === 'warning')
    ).length
  }, [violations, activeSheetGuid])

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div>
          <Link href="/dashboard" className="text-xs text-accent hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-text-primary">{project.name}</h1>
          <p className="text-xs text-text-secondary">
            {project.city}, {project.state} · {analysis.project_type} ·{' '}
            {analysis.violation_count} violations · {analysis.warning_count} warnings
            {activeSheet && sheetViolationCount > 0 && (
              <> · {sheetViolationCount} on current sheet</>
            )}
          </p>
        </div>
        <Link
          href="/analyze"
          className="rounded-md border border-border px-3 py-1.5 text-sm text-text-primary transition hover:border-accent hover:text-accent"
        >
          New analysis
        </Link>
      </header>

      {toast && (
        <div
          className="shrink-0 border-b border-accent/30 bg-accent/10 px-4 py-2 text-center text-sm text-text-primary transition-opacity duration-200"
          role="status"
        >
          {toast}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-[65] border-r border-border">
          {isAps && project.aps_urn ? (
            <ForgeViewer
              urn={project.aps_urn}
              violations={violations}
              selectedId={selectedId}
              onSelect={setSelectedId}
              locateViolation={locateViolation}
              onSheetChange={handleSheetChange}
            />
          ) : pdfUrl ? (
            <PdfViewer
              pdfUrl={pdfUrl}
              violations={violations}
              selectedId={selectedId}
              onSelect={setSelectedId}
              locateViolation={locateViolation}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-text-secondary">
              No plan source available for this analysis.
            </div>
          )}
        </div>
        <div className="min-w-0 flex-[35]">
          <ViolationPanel
            violations={violations}
            selectedId={selectedId}
            activeSheetGuid={activeSheetGuid}
            onSelect={setSelectedId}
            onLocate={handleLocate}
          />
        </div>
      </div>
    </div>
  )
}
