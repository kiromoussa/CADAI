'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import clsx from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { AppHeader } from '@/components/AppHeader'
import { disciplineLabel } from '@/lib/analysis/disciplines'
import { ProjectSetupFields, Field } from '@/components/projects/ProjectSetupFields'
import type { Discipline } from '@/types/analysis'

type SourceType = 'pdf' | 'cad' | 'aps'
type Step = 1 | 2 | 3

interface ApsProject {
  hub_id: string
  hub_name: string
  project_id: string
  project_name: string
}

interface ApsItem {
  item_id: string
  version_id: string
  name: string
  urn: string
}

export default function AnalyzePageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [step, setStep] = useState<Step>(1)
  const [name, setName] = useState('')
  const [city, setCity] = useState('Santa Ana')
  const [state, setState] = useState('CA')
  const [projectType, setProjectType] = useState('residential')
  const [sourceType, setSourceType] = useState<SourceType>('pdf')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [cadFile, setCadFile] = useState<File | null>(null)
  const [apsConnected, setApsConnected] = useState(false)
  const [apsProjects, setApsProjects] = useState<ApsProject[]>([])
  const [selectedHubProject, setSelectedHubProject] = useState<ApsProject | null>(null)
  const [apsItems, setApsItems] = useState<ApsItem[]>([])
  const [selectedItem, setSelectedItem] = useState<ApsItem | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [progressMessage, setProgressMessage] = useState('')
  const [progressStage, setProgressStage] = useState('')
  const [activeDiscipline, setActiveDiscipline] = useState<Discipline | null>(null)
  const [sheetProgress, setSheetProgress] = useState<{
    current: number
    total: number
  } | null>(null)
  const [completedDisciplines, setCompletedDisciplines] = useState<Discipline[]>([])
  const [pipelineStep, setPipelineStep] = useState<
    'upload' | 'translate' | 'extract' | 'codes' | 'done'
  >('upload')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (searchParams.get('aps_connected') === '1') {
      setApsConnected(true)
      setSourceType('aps')
    }
    const apsError = searchParams.get('aps_error')
    if (apsError) setError(decodeURIComponent(apsError))
  }, [searchParams])

  useEffect(() => {
    async function checkAps() {
      const { data } = await supabase
        .from('profiles')
        .select('aps_access_token')
        .maybeSingle()
      if (data?.aps_access_token) setApsConnected(true)
    }
    checkAps()
  }, [supabase])

  const loadApsProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/aps/models')
      const data = (await res.json()) as { projects?: ApsProject[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to load Autodesk projects')
      setApsProjects(data.projects ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (step === 2 && sourceType === 'aps' && apsConnected) {
      loadApsProjects()
    }
  }, [step, sourceType, apsConnected, loadApsProjects])

  useEffect(() => {
    async function loadItems() {
      if (!selectedHubProject) return
      setLoading(true)
      try {
        const params = new URLSearchParams({
          hub_id: selectedHubProject.hub_id,
          project_id: selectedHubProject.project_id,
        })
        const res = await fetch(`/api/aps/items?${params}`)
        const data = (await res.json()) as { items?: ApsItem[]; error?: string }
        if (!res.ok) throw new Error(data.error ?? 'Failed to load models')
        setApsItems(data.items ?? [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load models')
      } finally {
        setLoading(false)
      }
    }
    loadItems()
  }, [selectedHubProject])

  async function connectAutodesk() {
    window.location.href = '/api/aps/oauth'
  }

  async function createProjectAndAnalyze() {
    setStep(3)
    setError(null)
    setLoading(true)
    setProgressMessage('Preparing analysis…')
    setProgressStage('')
    setActiveDiscipline(null)
    setSheetProgress(null)
    setCompletedDisciplines([])
    setPipelineStep('upload')

    try {
      let pdfStoragePath: string | undefined
      let apsUrn: string | undefined
      let hubId: string | undefined
      let apsProjectId: string | undefined
      let itemId: string | undefined

      if (sourceType === 'pdf') {
        if (!pdfFile) throw new Error('Select a PDF floor plan')
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        pdfStoragePath = `${user.id}/${Date.now()}-${pdfFile.name}`
        const { error: uploadError } = await supabase.storage
          .from('floor-plans')
          .upload(pdfStoragePath, pdfFile, { contentType: 'application/pdf' })
        if (uploadError) throw new Error(uploadError.message)
      } else if (sourceType === 'cad') {
        if (!cadFile) throw new Error('Select a CAD file (DWG, RVT, IFC, etc.)')
      } else {
        if (!selectedItem || !selectedHubProject) {
          throw new Error('Select an Autodesk model')
        }
        apsUrn = selectedItem.urn
        hubId = selectedHubProject.hub_id
        apsProjectId = selectedHubProject.project_id
        itemId = selectedItem.item_id
      }

      const projectRes = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          city,
          state,
          project_type: projectType,
          source_type: sourceType === 'cad' ? 'aps' : sourceType,
          pdf_storage_path: pdfStoragePath,
          aps_urn: apsUrn,
          aps_hub_id: hubId,
          aps_project_id: apsProjectId,
          aps_item_id: itemId,
        }),
      })
      const projectData = (await projectRes.json()) as {
        project_id?: string
        error?: string
      }
      if (!projectRes.ok || !projectData.project_id) {
        throw new Error(projectData.error ?? 'Failed to create project')
      }

      const newProjectId = projectData.project_id
      setProjectId(newProjectId)

      if (sourceType === 'cad' && cadFile) {
        setPipelineStep('upload')
        setProgressStage('uploading')
        setProgressMessage('Uploading CAD file directly to Autodesk…')
        const cadUpload = await uploadCadDirectToOss(cadFile, newProjectId)
        apsUrn = cadUpload.urn
        await waitForTranslation(apsUrn, newProjectId, (message) => {
          setPipelineStep('translate')
          setProgressStage('translating')
          setProgressMessage(message)
        }, { fileName: cadFile.name })
      } else if (sourceType === 'aps' && apsUrn) {
        const itemsRes = await fetch('/api/aps/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: newProjectId,
            urn: apsUrn,
            file_name: selectedItem?.name,
            hub_id: hubId,
            aps_project_id: apsProjectId,
            item_id: itemId,
          }),
        })
        const itemsData = (await itemsRes.json()) as { status?: string; error?: string }
        if (!itemsRes.ok) {
          throw new Error(itemsData.error ?? 'Failed to start model translation')
        }
        if (itemsData.status !== 'complete') {
          await waitForTranslation(apsUrn, newProjectId, (message) => {
            setPipelineStep('translate')
            setProgressStage('translating')
            setProgressMessage(message)
          }, { fileName: selectedItem?.name })
        }
      }

      // --- Create a board and source node so everything flows through one backend ---
      const boardRes = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: name,
          default_city: city,
          default_state: state,
          default_project_type: projectType,
          project_id: newProjectId,
        }),
      })
      const boardData = (await boardRes.json()) as { board?: { id: string }; error?: string }
      if (!boardRes.ok || !boardData.board) {
        throw new Error(boardData.error ?? 'Failed to create board')
      }
      const boardId = boardData.board.id

      const nodeElementId = `node-${crypto.randomUUID().slice(0, 8)}`
      const nodeType = sourceType === 'pdf' ? 'pdf' : 'forge'
      const nodeRes = await fetch(`/api/boards/${boardId}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          excalidraw_element_id: nodeElementId,
          node_type: nodeType,
          x: 100,
          y: 100,
          width: 480,
          height: 360,
          project_id: newProjectId,
          storage_path: pdfStoragePath ?? null,
          aps_urn: apsUrn ?? null,
          content: {
            label: name,
            doc_kind: sourceType === 'pdf' ? 'document' : 'cad',
          },
        }),
      })
      const nodeData = (await nodeRes.json()) as { node?: { id: string }; error?: string }
      if (!nodeRes.ok || !nodeData.node) {
        throw new Error(nodeData.error ?? 'Failed to create source node')
      }
      const sourceNodeId = nodeData.node.id

      // Route analysis through the board-node endpoint (single backend)
      const analyzeRes = await fetch(
        `/api/boards/${boardId}/nodes/${sourceNodeId}/analyze`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            city,
            state,
            project_type: projectType,
          }),
        }
      )

      if (!analyzeRes.ok || !analyzeRes.body) {
        const errData = (await analyzeRes.json().catch(() => ({}))) as { error?: string }
        throw new Error(errData.error ?? 'Analysis request failed')
      }

      const reader = analyzeRes.body.getReader()
      const decoder = new TextDecoder()
      let analysisId: string | null = null
      let buffer = ''
      let lastDiscipline: Discipline | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() ?? ''

        for (const chunk of chunks) {
          const dataLine = chunk.split('\n').find((l) => l.startsWith('data: '))
          if (!dataLine) continue
          const jsonText = dataLine.slice(6).trim()
          if (!jsonText) continue
          let payload: {
            stage: string
            message: string
            analysis_id?: string
            error?: string
            discipline?: Discipline
            sheet_index?: number
            sheet_total?: number
          }
          try {
            payload = JSON.parse(jsonText)
          } catch {
            continue
          }
          setProgressStage(payload.stage)
          setProgressMessage(payload.message)
          if (payload.analysis_id) analysisId = payload.analysis_id

          if (payload.stage === 'extracting') {
            setPipelineStep('extract')
            if (payload.sheet_index != null && payload.sheet_total != null) {
              setSheetProgress({
                current: payload.sheet_index,
                total: payload.sheet_total,
              })
            }
          } else if (payload.stage === 'searching_codes' || payload.stage === 'analyzing') {
            setPipelineStep('codes')
            if (payload.discipline) {
              if (lastDiscipline && lastDiscipline !== payload.discipline) {
                setCompletedDisciplines((done) =>
                  done.includes(lastDiscipline!) ? done : [...done, lastDiscipline!]
                )
              }
              lastDiscipline = payload.discipline
              setActiveDiscipline(payload.discipline)
            }
          } else if (payload.stage === 'complete') {
            setPipelineStep('done')
            if (lastDiscipline) {
              setCompletedDisciplines((done) =>
                done.includes(lastDiscipline!) ? done : [...done, lastDiscipline!]
              )
              lastDiscipline = null
              setActiveDiscipline(null)
            }
          }

          if (payload.stage === 'error') {
            throw new Error(payload.error ?? payload.message)
          }
          if (payload.stage === 'complete' && payload.analysis_id) {
            // Create report node next to source, then navigate to the board
            const reportElementId = `node-${crypto.randomUUID().slice(0, 8)}`
            await fetch(`/api/boards/${boardId}/nodes`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                excalidraw_element_id: reportElementId,
                node_type: 'pdf',
                x: 100 + 480 + 40,
                y: 100,
                width: 480,
                height: 360,
                analysis_id: payload.analysis_id,
                content: {
                  label: 'Compliance Report',
                  doc_kind: 'document',
                  analysis_status: 'complete',
                  linked_analysis_id: payload.analysis_id,
                  linked_source_node_id: sourceNodeId,
                },
              }),
            })
            router.push(`/board/${boardId}`)
            return
          }
        }
      }

      if (analysisId) {
        router.push(`/board/${boardId}`)
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Analysis failed'
      const message =
        /input stream|network error|failed to fetch|aborted|connection reset|json\.parse/i.test(
          raw
        )
          ? 'Analysis was interrupted while reading the plan.try again or export a PDF from your CAD tool.'
          : raw
      const withHint =
        sourceType === 'cad' || sourceType === 'aps'
          ? `${message} You can return to the dashboard and retry, or upload a PDF exported from your CAD tool.`
          : message
      setError(withHint)
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  const stepLabels = useMemo(
    () => ['Project info', 'Plan source', 'Analysis'],
    []
  )

  return (
    <div className="min-h-screen">
      <AppHeader title="New compliance analysis" subtitle="Upload a plan or connect Autodesk" />

      <div className="mx-auto max-w-2xl px-6 py-8">
        <ol className="mb-8 flex gap-2">
          {stepLabels.map((label, i) => {
            const n = (i + 1) as Step
            return (
              <li
                key={label}
                className={clsx(
                  'flex-1 rounded-md border px-3 py-2 text-center text-xs font-medium',
                  step === n
                    ? 'border-accent bg-accent/10 text-accent'
                    : step > n
                      ? 'border-severity-pass/40 text-severity-pass'
                      : 'border-border text-text-secondary'
                )}
              >
                {n}. {label}
              </li>
            )
          })}
        </ol>

        {error && (
          <div className="mb-4 rounded-md border border-severity-violation/40 bg-severity-violation/10 px-4 py-3 text-sm text-severity-violation">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 rounded-lg border border-border bg-surface p-6">
            <ProjectSetupFields
              values={{ name, city, state, projectType }}
              onChange={(patch) => {
                if (patch.name !== undefined) setName(patch.name)
                if (patch.city !== undefined) setCity(patch.city)
                if (patch.state !== undefined) setState(patch.state)
                if (patch.projectType !== undefined) setProjectType(patch.projectType)
              }}
            />
            <button
              type="button"
              disabled={!name.trim()}
              onClick={() => setStep(2)}
              className="btn-primary w-full"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 rounded-lg border border-border bg-surface p-6">
            <div className="flex flex-wrap gap-2">
              <SourceTab
                active={sourceType === 'pdf'}
                onClick={() => setSourceType('pdf')}
                label="PDF"
              />
              <SourceTab
                active={sourceType === 'cad'}
                onClick={() => setSourceType('cad')}
                label="CAD file"
              />
              <SourceTab
                active={sourceType === 'aps'}
                onClick={() => setSourceType('aps')}
                label="Autodesk cloud"
              />
            </div>

            {sourceType === 'pdf' ? (
              <Field label="Floor plan PDF">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-text-secondary file:mr-4 file:rounded-md file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                />
              </Field>
            ) : sourceType === 'cad' ? (
              <Field label="CAD model (DWG, RVT, IFC, …)">
                <input
                  type="file"
                  accept=".dwg,.rvt,.ifc,.nwd,.nwc,.dxf,application/vnd.autodesk.autocad.dwg"
                  onChange={(e) => setCadFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-text-secondary file:mr-4 file:rounded-md file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
                />
                <p className="mt-2 text-xs text-text-secondary">
                  Upload goes straight to Autodesk (not through our servers). We translate 2D sheet
                  views (floor plans); DWG and IFC are fastest. Large Revit files take longer.
                </p>
                {cadFile && cadFile.size > 80 * 1024 * 1024 && (
                  <p className="mt-1 text-xs text-severity-warning">
                    Large file ({formatFileSize(cadFile.size)}).translation may take 10+ minutes.
                  </p>
                )}
              </Field>
            ) : (
              <div className="space-y-4">
                {!apsConnected ? (
                  <div className="rounded-md border border-border bg-background/40 p-4">
                    <p className="text-sm text-text-secondary">
                      Connect your Autodesk account to analyze Revit models in the viewer.
                    </p>
                    <button type="button" onClick={connectAutodesk} className="btn-primary mt-3">
                      Connect Autodesk
                    </button>
                  </div>
                ) : (
                  <>
                    <Field label="ACC / BIM 360 project">
                      <select
                        className="input-field"
                        value={
                          selectedHubProject
                            ? `${selectedHubProject.hub_id}:${selectedHubProject.project_id}`
                            : ''
                        }
                        onChange={(e) => {
                          const [hub_id, project_id] = e.target.value.split(':')
                          const found = apsProjects.find(
                            (p) => p.hub_id === hub_id && p.project_id === project_id
                          )
                          setSelectedHubProject(found ?? null)
                          setSelectedItem(null)
                        }}
                      >
                        <option value="">Select project…</option>
                        {apsProjects.map((p) => (
                          <option
                            key={`${p.hub_id}:${p.project_id}`}
                            value={`${p.hub_id}:${p.project_id}`}
                          >
                            {p.hub_name} / {p.project_name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {selectedHubProject && (
                      <Field label="Model file">
                        <select
                          className="input-field"
                          value={selectedItem?.urn ?? ''}
                          onChange={(e) => {
                            const item = apsItems.find((i) => i.urn === e.target.value)
                            setSelectedItem(item ?? null)
                          }}
                        >
                          <option value="">Select model…</option>
                          {apsItems.map((item) => (
                            <option key={item.urn} value={item.urn}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                        <p className="mt-2 text-xs text-text-secondary">
                          Models already translated in Autodesk open almost instantly; only new or
                          changed versions need a fresh translation.
                        </p>
                      </Field>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">
                Back
              </button>
              <button
                type="button"
                disabled={
                  loading ||
                  (sourceType === 'pdf' && !pdfFile) ||
                  (sourceType === 'cad' && !cadFile) ||
                  (sourceType === 'aps' && (!apsConnected || !selectedItem))
                }
                onClick={createProjectAndAnalyze}
                className="btn-primary flex-1"
              >
                Run analysis
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="rounded-lg border border-border bg-surface p-8">
            <PipelineStepper active={pipelineStep} />
            <div className="mt-8 text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <p className="text-sm font-medium capitalize text-text-primary">
                {progressStage.replace(/_/g, ' ') || 'Working'}
              </p>
              <p className="mt-2 text-sm text-text-secondary">{progressMessage}</p>
              {sheetProgress && (
                <div className="mx-auto mt-4 max-w-xs">
                  <div className="h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-300"
                      style={{
                        width: `${Math.round((sheetProgress.current / sheetProgress.total) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    Sheet {sheetProgress.current} of {sheetProgress.total}
                  </p>
                </div>
              )}
              {(activeDiscipline || completedDisciplines.length > 0) && (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {completedDisciplines.map((d) => (
                    <span
                      key={d}
                      className="rounded-full border border-severity-pass/40 bg-severity-pass/10 px-2 py-0.5 text-xs text-severity-pass"
                    >
                      {disciplineLabel(d)} ✓
                    </span>
                  ))}
                  {activeDiscipline &&
                    !completedDisciplines.includes(activeDiscipline) && (
                      <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs text-accent">
                        {disciplineLabel(activeDiscipline)}…
                      </span>
                    )}
                </div>
              )}
              {projectId && (
                <p className="mt-4 font-mono text-xs text-text-secondary">
                  Project {projectId}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SourceTab({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition',
        active
          ? 'border-accent bg-accent/10 text-accent'
          : 'border-border text-text-secondary hover:text-text-primary'
      )}
    >
      {label}
    </button>
  )
}

const TRANSLATION_MAX_WAIT_MS = 20 * 60 * 1000

async function uploadCadDirectToOss(
  file: File,
  projectId: string
): Promise<{ urn: string; status: string }> {
  const prepareRes = await fetch('/api/aps/upload/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_name: file.name }),
  })
  const prepareData = (await prepareRes.json()) as {
    object_key?: string
    upload_key?: string
    upload_urls?: string[]
    content_type?: string
    error?: string
  }
  if (!prepareRes.ok || !prepareData.object_key || !prepareData.upload_key) {
    throw new Error(prepareData.error ?? 'Failed to prepare CAD upload')
  }

  const urls = prepareData.upload_urls ?? []
  if (!urls.length) throw new Error('No upload URL returned from Autodesk')

  await putFileToSignedUrls(file, urls, prepareData.content_type ?? 'application/octet-stream')

  const completeRes = await fetch('/api/aps/upload/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      object_key: prepareData.object_key,
      upload_key: prepareData.upload_key,
      file_name: file.name,
    }),
  })
  const completeData = (await completeRes.json()) as {
    urn?: string
    status?: string
    error?: string
  }
  if (!completeRes.ok || !completeData.urn) {
    throw new Error(completeData.error ?? 'Failed to finalize CAD upload')
  }

  return {
    urn: completeData.urn,
    status: completeData.status ?? 'processing',
  }
}

async function putFileToSignedUrls(
  file: File,
  urls: string[],
  contentType: string
): Promise<void> {
  if (urls.length === 1) {
    const putRes = await fetch(urls[0], {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    })
    if (!putRes.ok) {
      throw new Error(`Direct upload failed (${putRes.status})`)
    }
    return
  }

  const partSize = Math.ceil(file.size / urls.length)
  for (let i = 0; i < urls.length; i++) {
    const start = i * partSize
    const end = Math.min(start + partSize, file.size)
    const chunk = file.slice(start, end)
    const putRes = await fetch(urls[i], {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: chunk,
    })
    if (!putRes.ok) {
      throw new Error(`Direct upload part ${i + 1} failed (${putRes.status})`)
    }
  }
}

type TranslationPollPayload = {
  status?: string
  message?: string
  progress?: string
  error?: string
  retryable?: boolean
  stalled?: boolean
  retrying?: boolean
  force_retried?: boolean
  child_errors?: string[]
}

async function parseTranslationPollResponse(res: Response): Promise<{
  data: TranslationPollPayload
  parseFailed: boolean
}> {
  const text = await res.text()
  if (!text.trim()) {
    return { data: {}, parseFailed: true }
  }
  try {
    return { data: JSON.parse(text) as TranslationPollPayload, parseFailed: false }
  } catch {
    return { data: {}, parseFailed: true }
  }
}

function isRetryableTranslationPoll(
  res: Response,
  data: TranslationPollPayload,
  parseFailed: boolean
): boolean {
  return (
    parseFailed ||
    res.status === 404 ||
    res.status === 503 ||
    res.status >= 502 ||
    data.retryable === true
  )
}

async function waitForTranslation(
  urn: string,
  projectId: string,
  onProgress?: (message: string) => void,
  options?: { fileName?: string }
): Promise<void> {
  const started = Date.now()
  let pollIntervalMs = 2000
  let networkRetries = 0
  const fileName = options?.fileName?.toLowerCase() ?? ''
  const isDwg = fileName.endsWith('.dwg') || fileName.endsWith('.dxf')
  const dwgExpectation =
    ' DWG translation usually takes 2–8 minutes for multi-sheet files.'

  let lastProgress = ''
  let lastProgressChangeAt = Date.now()

  while (Date.now() - started < TRANSLATION_MAX_WAIT_MS) {
    try {
      const params = new URLSearchParams()
      params.set('urn', urn)
      params.set('project_id', projectId)
      const res = await fetch(`/api/aps/translation?${params}`)
      const { data, parseFailed } = await parseTranslationPollResponse(res)

      if (res.status === 401) {
        throw new Error('Session expired.sign in again and reopen this project from the dashboard.')
      }

      if (isRetryableTranslationPoll(res, data, parseFailed)) {
        if (networkRetries < 20) {
          networkRetries += 1
          onProgress?.(
            data.message ??
              (res.status === 404 || parseFailed
                ? 'Waiting for translation service.retrying…'
                : 'Temporary network issue.retrying…')
          )
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
          continue
        }
        throw new Error(data.error ?? 'Translation status check failed')
      }

      if (!res.ok) {
        throw new Error(data.error ?? 'Translation status check failed')
      }

      networkRetries = 0

      const progressStr =
        typeof data.progress === 'string' ? data.progress : ''
      if (progressStr && progressStr !== lastProgress) {
        lastProgress = progressStr
        lastProgressChangeAt = Date.now()
      }

      let message = data.message ?? 'Translating model for viewer…'

      if (data.retrying) {
        message =
          'Restarted translation with DWG-optimized PDF sheet settings.this usually takes 2–5 minutes…'
      } else if (data.stalled && data.force_retried && data.status === 'processing') {
        message =
          progressStr && progressStr.includes('%')
            ? `Finishing DWG sheets (${progressStr})…`
            : 'Finishing DWG sheet conversion…'
      } else if (data.stalled && data.status === 'processing') {
        message =
          'Translation appears stuck.retrying with DWG-optimized sheet export settings…'
      } else if (
        progressStr.includes('99%') &&
        Date.now() - lastProgressChangeAt > 3 * 60 * 1000
      ) {
        message =
          'Translation appears stuck at 99%.retrying with DWG sheet export settings…'
      } else if (isDwg && data.status === 'processing' && !progressStr.includes('99%')) {
        if (!message.includes('2–8 minutes')) {
          message = `${message}${dwgExpectation}`
        }
      }

      onProgress?.(message)

      if (data.status === 'complete') return
      if (data.status === 'failed') {
        const childHint = data.child_errors?.[0]
        throw new Error(
          childHint && !message.includes(childHint)
            ? `${message} (${childHint})`
            : message
        )
      }
    } catch (err) {
      const isFetchFailure = err instanceof TypeError && err.message === 'Failed to fetch'
      const isJsonFailure = err instanceof SyntaxError
      if ((isFetchFailure || isJsonFailure) && networkRetries < 20) {
        networkRetries += 1
        onProgress?.('Connection interrupted.retrying…')
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
        continue
      }
      throw err
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    pollIntervalMs = Math.min(Math.round(pollIntervalMs * 1.25), 10000)
  }

  throw new Error(
    isDwg
      ? 'Model translation timed out after 20 minutes. Return to the dashboard and try again, or upload a PDF exported from AutoCAD instead.'
      : 'Model translation timed out after 20 minutes. Return to the dashboard and open this project again in a few minutes.'
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const PIPELINE_STEPS = [
  { id: 'upload' as const, label: 'Upload' },
  { id: 'translate' as const, label: 'Translate' },
  { id: 'extract' as const, label: 'Extract sheets' },
  { id: 'codes' as const, label: 'Check codes' },
  { id: 'done' as const, label: 'Done' },
]

function PipelineStepper({
  active,
}: {
  active: 'upload' | 'translate' | 'extract' | 'codes' | 'done'
}) {
  const activeIndex = PIPELINE_STEPS.findIndex((s) => s.id === active)

  return (
    <ol className="flex items-center justify-between gap-1">
      {PIPELINE_STEPS.map((step, i) => {
        const done = i < activeIndex
        const current = i === activeIndex
        return (
          <li key={step.id} className="flex flex-1 flex-col items-center">
            <span
              className={clsx(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition duration-200',
                done && 'bg-severity-pass/20 text-severity-pass',
                current && 'bg-accent/20 text-accent ring-2 ring-accent/40',
                !done && !current && 'bg-border/50 text-text-secondary'
              )}
            >
              {done ? '✓' : i + 1}
            </span>
            <span
              className={clsx(
                'mt-1 text-center text-[10px] font-medium',
                current ? 'text-accent' : 'text-text-secondary'
              )}
            >
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
