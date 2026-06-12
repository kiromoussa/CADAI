import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBoardForUser, getNodeForBoard } from '@/lib/canvas/board-access'
import type { Json } from '@/types/database'

interface RouteParams {
  params: { id: string; nodeId: string }
}

export async function PATCH(request: Request, { params }: RouteParams) {
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

  const body = (await request.json()) as {
    x?: number
    y?: number
    width?: number
    height?: number
    content?: Record<string, unknown>
    project_id?: string
    storage_path?: string
    aps_urn?: string
    analysis_id?: string
  }

  const { data, error } = await supabase
    .from('canvas_nodes')
    .update({
      ...body,
      content: body.content ? (body.content as Json) : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.nodeId)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ node: data })
}

export async function DELETE(_request: Request, { params }: RouteParams) {
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

  const { error } = await supabase
    .from('canvas_nodes')
    .delete()
    .eq('id', params.nodeId)
    .eq('board_id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
