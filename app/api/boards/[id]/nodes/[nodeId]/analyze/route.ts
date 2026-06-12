import { createClient } from '@/lib/supabase/server'
import { getBoardForUser, getNodeForBoard } from '@/lib/canvas/board-access'
import {
  createAnalysisRecord,
  createAnalysisStream,
  sseResponseHeaders,
  type AnalyzeRequestInput,
} from '@/lib/analysis/run-analysis-stream'
import type { ProjectRow } from '@/types/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface RouteParams {
  params: { id: string; nodeId: string }
}

export async function POST(request: Request, { params }: RouteParams) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const board = await getBoardForUser(supabase, params.id, user.id)
  if (!board) {
    return new Response(JSON.stringify({ error: 'Board not found' }), { status: 404 })
  }

  const node = await getNodeForBoard(supabase, params.id, params.nodeId)
  if (!node) {
    return new Response(JSON.stringify({ error: 'Node not found' }), { status: 404 })
  }

  if (!node.project_id) {
    return new Response(
      JSON.stringify({ error: 'Attach a floor plan to this node before running compliance' }),
      { status: 400 }
    )
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', node.project_id)
    .eq('user_id', user.id)
    .single()

  if (projectError || !project) {
    return new Response(JSON.stringify({ error: 'Project not found' }), { status: 404 })
  }

  let pdfBase64: string | undefined
  const sourceType = project.source_type === 'aps' ? 'aps' : 'pdf'

  if (sourceType === 'pdf' && project.pdf_storage_path) {
    const { data: blob, error: downloadError } = await supabase.storage
      .from('floor-plans')
      .download(project.pdf_storage_path)

    if (downloadError || !blob) {
      return new Response(
        JSON.stringify({ error: downloadError?.message ?? 'Failed to load PDF' }),
        { status: 500 }
      )
    }
    const bytes = Buffer.from(await blob.arrayBuffer())
    pdfBase64 = bytes.toString('base64')
  }

  const body = (await request.json().catch(() => ({}))) as {
    city?: string
    state?: string
    project_type?: string
  }

  const input: AnalyzeRequestInput = {
    project_id: project.id,
    city: body.city ?? board.default_city ?? project.city,
    state: body.state ?? board.default_state ?? project.state,
    project_type: body.project_type ?? board.default_project_type ?? project.project_type,
    source_type: sourceType,
    pdf_base64: pdfBase64,
    aps_urn: node.aps_urn ?? project.aps_urn ?? undefined,
    file_name: project.original_file_name ?? undefined,
    canvas_node_id: node.id,
  }

  let analysisId: string
  try {
    analysisId = await createAnalysisRecord(user.id, input)
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Failed to create analysis',
      }),
      { status: 500 }
    )
  }

  await supabase
    .from('canvas_nodes')
    .update({
      analysis_id: analysisId,
      content: {
        ...(typeof node.content === 'object' && node.content !== null ? node.content : {}),
        analysis_status: 'running',
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', node.id)

  const stream = createAnalysisStream(
    analysisId,
    user.id,
    project as ProjectRow,
    input
  )

  const wrapped = new ReadableStream({
    async start(controller) {
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(value)

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() ?? ''

          for (const chunk of lines) {
            const dataLine = chunk.split('\n').find((l) => l.startsWith('data: '))
            if (!dataLine) continue
            try {
              const event = JSON.parse(dataLine.slice(6)) as { stage?: string }
              if (event.stage === 'complete' || event.stage === 'error') {
                const status = event.stage === 'complete' ? 'complete' : 'error'
                await supabase
                  .from('canvas_nodes')
                  .update({
                    analysis_id: analysisId,
                    content: {
                      ...(typeof node.content === 'object' && node.content !== null
                        ? node.content
                        : {}),
                      analysis_status: status,
                    },
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', node.id)
              }
            } catch {
              // ignore parse errors in stream tail
            }
          }
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(wrapped, { headers: sseResponseHeaders() })
}
