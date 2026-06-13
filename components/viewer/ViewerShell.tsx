'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { disciplineLabel } from '@/lib/analysis/disciplines'
import type { AnalysisRow, ProjectRow, ViolationRow } from '@/types/database'
import { ViolationPanel } from '@/components/viewer/ViolationPanel'
import { ExcalidrawOverlay } from '@/components/viewer/ExcalidrawOverlay'
import { ReadinessBanner } from '@/components/viewer/ReadinessBanner'
import { PlanChatPanel } from '@/components/board/PlanChatPanel'
import { computeReadinessScore, type ReadinessResult } from '@/lib/analysis/readiness'
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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)
  const [violationList, setViolationList] = useState(violations)

  const readiness = useMemo((): ReadinessResult => {
    if (
      analysis.readiness_data &&
      typeof analysis.readiness_data === 'object' &&
      !Array.isArray(analysis.readiness_data)
    ) {
      return analysis.readiness_data as unknown as ReadinessResult
    }
    return computeReadinessScore(violationList)
  }, [analysis.readiness_data, violationList])

  const handleViolationUpdate = useCallback((updated: ViolationRow) => {
    setViolationList((prev) => prev.map((v) => (v.id === updated.id ? updated : v)))
  }, [])

  const handleLocate = useCallback((violation: ViolationRow) => {
    setSelectedId(violation.id)
    setLocateViolation(violation)
  }, [])

  const handleSheetChange = useCallback(
    (sheet: ViewerSheet) => {
      setActiveSheet(sheet)
      const onSheet = violationList.filter(
        (v) => !v.sheet_guid || v.sheet_guid === sheet.guid
      )
      const issueCount = onSheet.filter(
        (v) => v.severity === 'violation' || v.severity === 'warning'
      ).length
      const label = disciplineLabel(sheet.discipline)
      setToast(
        issueCount > 0
          ? `Showing ${label} - ${sheet.name} (${issueCount} finding${issueCount === 1 ? '' : 's'} on this sheet)`
          : `Showing ${label} - ${sheet.name}`
      )
    },
    [violationList]
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
    return violationList.filter(
      (v) =>
        (!v.sheet_guid || v.sheet_guid === activeSheetGuid) &&
        (v.severity === 'violation' || v.severity === 'warning')
    ).length
  }, [violationList, activeSheetGuid])

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div>
          <Link href="/dashboard" className="text-xs text-accent hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-text-primary">{project.name}</h1>
          <p className="text-xs text-text-secondary">
            {project.city}, {project.state} · {analysis.project_type}
            {analysis.readiness_score != null && (
              <>
                {' · '}
                <span className="font-semibold text-accent">
                  FirstPass {analysis.readiness_score}/100
                </span>
              </>
            )}
            {activeSheet && sheetViolationCount > 0 && (
              <> · {sheetViolationCount} on current sheet</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/analyses/${analysis.id}/approval-plan`}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-text-primary transition hover:border-accent hover:text-accent"
          >
            Approval plan
          </a>
          <a
            href={`/api/analyses/${analysis.id}/report`}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-text-primary transition hover:border-accent hover:text-accent"
          >
            Export report
          </a>
          <button
            type="button"
            onClick={() => setChatOpen((o) => !o)}
            className={
              'rounded-md border px-3 py-1.5 text-sm transition ' +
              (chatOpen
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border text-text-primary hover:border-accent')
            }
          >
            Plan chat
          </button>
          <Link
            href="/analyze"
            className="rounded-md border border-border px-3 py-1.5 text-sm text-text-primary transition hover:border-accent hover:text-accent"
          >
            New analysis
          </Link>
        </div>
      </header>

      {toast && (
        <div
          className="shrink-0 border-b border-accent/30 bg-accent/10 px-4 py-2 text-center text-sm text-text-primary transition-opacity duration-200"
          role="status"
        >
          {toast}
        </div>
      )}

      <div className="shrink-0 border-b border-border px-4 py-3">
        <ReadinessBanner readiness={readiness} />
      </div>

      <div className="relative flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 transition-all duration-300">
          {isAps && project.aps_urn ? (
            <ForgeViewer
              urn={project.aps_urn}
              violations={violationList}
              selectedId={selectedId}
              onSelect={setSelectedId}
              locateViolation={locateViolation}
              onSheetChange={handleSheetChange}
            />
          ) : pdfUrl ? (
            <div className="relative h-full">
              <PdfViewer
                pdfUrl={pdfUrl}
                violations={violationList}
                selectedId={selectedId}
                onSelect={setSelectedId}
                locateViolation={locateViolation}
              />
              <ExcalidrawOverlay
                analysisId={analysis.id}
                violations={violationList}
                sheetGuid={activeSheetGuid}
                onViolationSelect={setSelectedId}
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-text-secondary">
              No plan source available for this analysis.
            </div>
          )}
        </div>

        <button
          onClick={() => setSidebarOpen((o) => !o)}
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-l-md border border-r-0 border-border bg-surface px-1.5 py-3 text-text-secondary transition-all hover:bg-surface-hover hover:text-text-primary"
          style={{ right: sidebarOpen ? 'calc(35% - 1px)' : 0 }}
          aria-label={sidebarOpen ? 'Collapse violations panel' : 'Expand violations panel'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-300 ${sidebarOpen ? 'rotate-0' : 'rotate-180'}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <div
          className={`shrink-0 border-l border-border transition-all duration-300 ${
            sidebarOpen ? 'w-[35%]' : 'w-0'
          } overflow-hidden`}
        >
          <div className="flex h-full w-[35vw] min-w-0">
            {chatOpen ? (
              <PlanChatPanel analysisId={analysis.id} className="h-full w-full" />
            ) : (
              <ViolationPanel
                violations={violationList}
                selectedId={selectedId}
                activeSheetGuid={activeSheetGuid}
                analysisId={analysis.id}
                onSelect={setSelectedId}
                onLocate={handleLocate}
                onViolationUpdate={handleViolationUpdate}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
