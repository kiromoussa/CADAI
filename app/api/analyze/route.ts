import { createClient } from '@/lib/supabase/server'
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

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  let body: AnalyzeRequestInput
  try {
    body = (await request.json()) as AnalyzeRequestInput
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  const { project_id, city, state, project_type, source_type } = body

  if (!project_id || !city || !state || !project_type || !source_type) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
    })
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', project_id)
    .eq('user_id', user.id)
    .single()

  if (projectError || !project) {
    return new Response(JSON.stringify({ error: 'Project not found' }), { status: 404 })
  }

  let analysisId: string
  try {
    analysisId = await createAnalysisRecord(user.id, body)
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Failed to create analysis',
      }),
      { status: 500 }
    )
  }

  const stream = createAnalysisStream(
    analysisId,
    user.id,
    project as ProjectRow,
    body
  )

  return new Response(stream, { headers: sseResponseHeaders() })
}
