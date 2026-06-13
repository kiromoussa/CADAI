'use client'

import { useState } from 'react'
import clsx from 'clsx'
import type { CodeInterpretation } from '@/lib/analysis/code-interpreter'
import type { ChecklistReviewResult } from '@/lib/analysis/checklist-review'
import type { VersionDiffResult } from '@/lib/analysis/version-diff'
import { PlanChatPanel } from '@/components/board/PlanChatPanel'

export type BoardToolTab = 'chat' | 'code' | 'checklist' | 'diff'

interface BoardToolsPanelProps {
  open: boolean
  onClose: () => void
  activeAnalysisId: string | null
  analysisOptions: Array<{ id: string; label: string }>
  jurisdiction?: string
  projectType?: string
}

import { DEFAULT_CHECKLIST_ITEMS } from '@/lib/persona/defaults'

export function BoardToolsPanel({
  open,
  onClose,
  activeAnalysisId,
  analysisOptions,
  jurisdiction,
  projectType,
}: BoardToolsPanelProps) {
  const [tab, setTab] = useState<BoardToolTab>('chat')
  const [codeSection, setCodeSection] = useState('R310.1')
  const [codeLoading, setCodeLoading] = useState(false)
  const [interpretation, setInterpretation] = useState<CodeInterpretation | null>(null)
  const [checklistItems, setChecklistItems] = useState(DEFAULT_CHECKLIST_ITEMS.join('\n'))
  const [checklistLoading, setChecklistLoading] = useState(false)
  const [checklistResult, setChecklistResult] = useState<ChecklistReviewResult | null>(null)
  const [priorId, setPriorId] = useState(analysisOptions[0]?.id ?? '')
  const [currentId, setCurrentId] = useState(
    analysisOptions[analysisOptions.length - 1]?.id ?? ''
  )
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffResult, setDiffResult] = useState<VersionDiffResult | null>(null)

  const runCodeInterpret = async () => {
    setCodeLoading(true)
    try {
      const res = await fetch('/api/code/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: codeSection,
          building_type: projectType,
          jurisdiction,
        }),
      })
      const data = (await res.json()) as {
        interpretation?: CodeInterpretation
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setInterpretation(data.interpretation ?? null)
    } catch {
      setInterpretation(null)
    } finally {
      setCodeLoading(false)
    }
  }

  const runChecklist = async () => {
    if (!activeAnalysisId) return
    setChecklistLoading(true)
    try {
      const items = checklistItems.split('\n').map((l) => l.trim()).filter(Boolean)
      const res = await fetch(`/api/analyses/${activeAnalysisId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, checklist_name: 'Board QA/QC Checklist' }),
      })
      const data = (await res.json()) as {
        result?: ChecklistReviewResult
        error?: string
      }
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setChecklistResult(data.result ?? null)
    } catch {
      setChecklistResult(null)
    } finally {
      setChecklistLoading(false)
    }
  }

  const runDiff = async () => {
    if (!priorId || !currentId || priorId === currentId) return
    setDiffLoading(true)
    try {
      const res = await fetch('/api/analyses/version-diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prior_analysis_id: priorId,
          current_analysis_id: currentId,
        }),
      })
      const data = (await res.json()) as { diff?: VersionDiffResult; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setDiffResult(data.diff ?? null)
    } catch {
      setDiffResult(null)
    } finally {
      setDiffLoading(false)
    }
  }

  if (!open) return null

  const tabs: Array<{ id: BoardToolTab; label: string }> = [
    { id: 'chat', label: 'Plan chat' },
    { id: 'code', label: 'Code' },
    { id: 'checklist', label: 'Checklist' },
    { id: 'diff', label: 'Version diff' },
  ]

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary">Board tools</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-text-secondary hover:text-text-primary"
        >
          Close
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={clsx(
              'whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium',
              tab === t.id
                ? 'bg-accent/20 text-accent'
                : 'text-text-secondary hover:bg-border/50'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'chat' && (
          <PlanChatPanel analysisId={activeAnalysisId} className="h-full" />
        )}

        {tab === 'code' && (
          <div className="h-full overflow-y-auto p-4">
            <p className="text-xs text-text-secondary">
              Explain any code section in plain English.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={codeSection}
                onChange={(e) => setCodeSection(e.target.value)}
                className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm"
                placeholder="e.g. R310.1"
              />
              <button
                type="button"
                disabled={codeLoading}
                onClick={() => void runCodeInterpret()}
                className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              >
                Explain
              </button>
            </div>
            {codeLoading && (
              <p className="mt-3 text-xs text-text-secondary">Loading…</p>
            )}
            {interpretation && (
              <div className="mt-4 space-y-3 text-sm">
                <p className="font-medium text-text-primary">{interpretation.section}</p>
                <p className="text-text-primary">{interpretation.plain_language}</p>
                <p className="text-xs text-text-secondary">
                  Applies to: {interpretation.applies_to}
                </p>
                {interpretation.related_sections.length > 0 && (
                  <p className="text-xs text-text-secondary">
                    Related: {interpretation.related_sections.join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'checklist' && (
          <div className="h-full overflow-y-auto p-4">
            <p className="text-xs text-text-secondary">
              Run a custom QA/QC checklist against the selected plan analysis.
            </p>
            <textarea
              value={checklistItems}
              onChange={(e) => setChecklistItems(e.target.value)}
              rows={8}
              className="mt-3 w-full rounded border border-border bg-background px-2 py-2 text-xs"
            />
            <button
              type="button"
              disabled={!activeAnalysisId || checklistLoading}
              onClick={() => void runChecklist()}
              className="mt-3 w-full rounded bg-accent py-2 text-xs font-medium text-white disabled:opacity-40"
            >
              {checklistLoading ? 'Running…' : 'Run checklist review'}
            </button>
            {checklistResult && (
              <div className="mt-4 space-y-2 text-xs">
                <p className="font-medium text-text-primary">
                  {checklistResult.overall_status} — {checklistResult.summary.pass} pass,{' '}
                  {checklistResult.summary.fail} fail, {checklistResult.summary.needs_review}{' '}
                  review
                </p>
                {checklistResult.results.map((r) => (
                  <div key={r.item_id} className="rounded border border-border p-2">
                    <p className="font-medium">{r.status}: {r.item_description}</p>
                    <p className="mt-1 text-text-secondary">{r.evidence}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'diff' && (
          <div className="h-full overflow-y-auto p-4">
            <p className="text-xs text-text-secondary">
              Compare two compliance runs to see what changed between revisions.
            </p>
            {analysisOptions.length < 2 ? (
              <p className="mt-3 text-xs text-text-secondary">
                Add and analyze at least two plan revisions on this board.
              </p>
            ) : (
              <>
                <label className="mt-3 block text-xs text-text-secondary">Prior revision</label>
                <select
                  value={priorId}
                  onChange={(e) => setPriorId(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
                >
                  {analysisOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <label className="mt-3 block text-xs text-text-secondary">Current revision</label>
                <select
                  value={currentId}
                  onChange={(e) => setCurrentId(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-xs"
                >
                  {analysisOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={diffLoading || priorId === currentId}
                  onClick={() => void runDiff()}
                  className="mt-3 w-full rounded bg-accent py-2 text-xs font-medium text-white disabled:opacity-40"
                >
                  {diffLoading ? 'Comparing…' : 'Compare versions'}
                </button>
              </>
            )}
            {diffResult && (
              <div className="mt-4 space-y-2 text-xs text-text-primary">
                <p>{diffResult.re_review_recommendation}</p>
                <p className="text-text-secondary">
                  Resolved: {diffResult.issues_resolved.length} · New:{' '}
                  {diffResult.new_issues_introduced.length}
                </p>
                {diffResult.new_issues_introduced.map((issue, i) => (
                  <div key={i} className="rounded border border-border p-2">
                    <p className="font-mono text-accent">{issue.code_section}</p>
                    <p>{issue.finding}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
