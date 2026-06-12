import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBoardForUser } from '@/lib/canvas/board-access'
import type { Json } from '@/types/database'

interface RouteParams {
  params: { id: string }
}

export async function GET(_request: Request, { params }: RouteParams) {
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

  const { data: nodes } = await supabase
    .from('canvas_nodes')
    .select('*')
    .eq('board_id', params.id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ board, nodes: nodes ?? [] })
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

  const body = (await request.json()) as {
    title?: string
    default_city?: string
    default_state?: string
    default_project_type?: string
    scene_json?: Json
    thumbnail_path?: string
  }

  const { data, error } = await supabase
    .from('canvas_boards')
    .update({
      ...body,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ board: data })
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

  const { error } = await supabase.from('canvas_boards').delete().eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
