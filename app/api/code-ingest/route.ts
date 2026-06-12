import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }

  const city = (form.get('city') as string | null) ?? undefined
  const state = (form.get('state') as string | null) ?? undefined
  const jurisdiction = (form.get('jurisdiction') as string | null) ?? undefined
  const codeYearRaw = form.get('code_year')
  const codeYear = codeYearRaw ? Number(codeYearRaw) : undefined
  const boardId = (form.get('board_id') as string | null) ?? undefined
  const nodeId = (form.get('node_id') as string | null) ?? undefined

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${user.id}/ingest/${Date.now()}-${safeName}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage
    .from('code-ingest')
    .upload(storagePath, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: job, error: jobError } = await supabase
    .from('code_ingest_jobs')
    .insert({
      user_id: user.id,
      board_id: boardId ?? null,
      node_id: nodeId ?? null,
      status: 'queued',
      storage_path: storagePath,
      jurisdiction: jurisdiction ?? null,
      city: city ?? null,
      state: state ?? null,
      code_year: codeYear ?? null,
    })
    .select('*')
    .single()

  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 500 })
  }

  // Worker stub: production runs Python ingest CLI against storage_path.
  // Poll GET /api/code-ingest/[jobId] for status updates.

  return NextResponse.json({
    job_id: job.id,
    job,
    message:
      'Job queued. Run the Python ingest worker against storage_path, or poll job status.',
  })
}
