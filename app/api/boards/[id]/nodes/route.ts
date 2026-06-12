import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBoardForUser } from '@/lib/canvas/board-access'
import type { Json } from '@/types/database'
import type { CanvasNodeType } from '@/types/canvas'

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

  const { data, error } = await supabase
    .from('canvas_nodes')
    .select('*')
    .eq('board_id', params.id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ nodes: data ?? [] })
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

  const body = (await request.json()) as {
    excalidraw_element_id: string
    node_type: CanvasNodeType
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

  if (!body.excalidraw_element_id || !body.node_type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('canvas_nodes')
    .insert({
      board_id: params.id,
      excalidraw_element_id: body.excalidraw_element_id,
      node_type: body.node_type,
      x: body.x ?? 0,
      y: body.y ?? 0,
      width: body.width ?? 480,
      height: body.height ?? 360,
      content: (body.content ?? {}) as Json,
      project_id: body.project_id ?? null,
      storage_path: body.storage_path ?? null,
      aps_urn: body.aps_urn ?? null,
      analysis_id: body.analysis_id ?? null,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ node: data })
}
