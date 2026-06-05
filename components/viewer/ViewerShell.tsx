'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import type { AnalysisRow, ProjectRow, ViolationRow } from '@/types/database'
import { ViolationPanel } from '@/components/viewer/ViolationPanel'
import { ForgeViewer } from '@/components/viewer/ForgeViewer'
import { PdfViewer } from '@/components/viewer/PdfViewer'

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

  const handleLocate = useCallback((violation: ViolationRow) => {
    setSelectedId(violation.id)
    setLocateViolation(violation)
  }, [])

  const isAps = analysis.source_type === 'aps' && project.aps_urn

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
          </p>
        </div>
        <Link
          href="/analyze"
          className="rounded-md border border-border px-3 py-1.5 text-sm text-text-primary transition hover:border-accent hover:text-accent"
        >
          New analysis
        </Link>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-[65] border-r border-border">
          {isAps && project.aps_urn ? (
            <ForgeViewer
              urn={project.aps_urn}
              violations={violations}
              selectedId={selectedId}
              onSelect={setSelectedId}
              locateViolation={locateViolation}
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
            onSelect={setSelectedId}
            onLocate={handleLocate}
          />
        </div>
      </div>
    </div>
  )
}
