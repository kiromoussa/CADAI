import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBoardForUser, getNodeForBoard } from '@/lib/canvas/board-access'
import type { Json } from '@/types/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: { id: string; nodeId: string }
}

export async function POST(request: Request, { params }: RouteParams) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const board = await getBoardForUser(supabase, params.id, user.id)
  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 })
  }

  const node = await getNodeForBoard(supabase, params.id, params.nodeId)
  if (!node) {
    return NextResponse.json({ error: 'Node not found' }, { status: 404 })
  }

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${user.id}/${params.id}/${params.nodeId}/${Date.now()}-${safeName}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage
    .from('floor-plans')
    .upload(storagePath, buffer, {
      contentType: file.type || 'application/pdf',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const projectName =
    (form.get('project_name') as string | null) ??
    (node.content as { label?: string })?.label ??
    file.name.replace(/\.[^.]+$/, '')

  const city = (form.get('city') as string | null) ?? board.default_city ?? 'Santa Ana'
  const state = (form.get('state') as string | null) ?? board.default_state ?? 'CA'
  const projectType =
    (form.get('project_type') as string | null) ??
    board.default_project_type ??
    'residential'

  // 'document' = a plain reference PDF: stored on the board but never analyzed, so
  // it does not get a compliance project. 'plan' (default) creates a project.
  const docKind =
    (form.get('doc_kind') as string | null) === 'document' ? 'document' : 'plan'

  let projectId = node.project_id

  if (docKind === 'document') {
    const content = {
      ...(typeof node.content === 'object' && node.content !== null ? node.content : {}),
      file_name: file.name,
      label: projectName,
      doc_kind: 'document' as const,
    }

    const { data: updatedDoc, error: docError } = await supabase
      .from('canvas_nodes')
      .update({
        storage_path: storagePath,
        node_type: 'pdf',
        content: content as Json,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.nodeId)
      .select('*')
      .single()

    if (docError) {
      return NextResponse.json({ error: docError.message }, { status: 500 })
    }

    const { data: signedDoc } = await supabase.storage
      .from('floor-plans')
      .createSignedUrl(storagePath, 3600)

    return NextResponse.json({
      node: updatedDoc,
      project_id: null,
      storage_path: storagePath,
      pdf_url: signedDoc?.signedUrl ?? null,
    })
  }

  if (!projectId) {
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: projectName,
        city,
        state,
        project_type: projectType,
        source_type: 'pdf',
        pdf_storage_path: storagePath,
        original_file_name: file.name,
        board_id: params.id,
      })
      .select('id')
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: projectError?.message ?? 'Failed to create project' },
        { status: 500 }
      )
    }
    projectId = project.id
  } else {
    await supabase
      .from('projects')
      .update({
        pdf_storage_path: storagePath,
        original_file_name: file.name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
  }

  const content = {
    ...(typeof node.content === 'object' && node.content !== null ? node.content : {}),
    file_name: file.name,
    label: projectName,
    doc_kind: 'plan' as const,
  }

  const { data: updatedNode, error: nodeError } = await supabase
    .from('canvas_nodes')
    .update({
      project_id: projectId,
      storage_path: storagePath,
      node_type: 'pdf',
      content: content as Json,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.nodeId)
    .select('*')
    .single()

  if (nodeError) {
    return NextResponse.json({ error: nodeError.message }, { status: 500 })
  }

  const { data: signed } = await supabase.storage
    .from('floor-plans')
    .createSignedUrl(storagePath, 3600)

  return NextResponse.json({
    node: updatedNode,
    project_id: projectId,
    storage_path: storagePath,
    pdf_url: signed?.signedUrl ?? null,
  })
}
