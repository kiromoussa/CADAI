import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildViolationOverlayScene } from '@/lib/excalidraw/violationToElements'
import type { Json } from '@/types/database'

interface RouteParams {
  params: { id: string }
}

export async function GET(request: Request, { params }: RouteParams) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: analysis } = await supabase
    .from('analyses')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
  }

  const url = new URL(request.url)
  const sheetGuid = url.searchParams.get('sheet_guid')

  let query = supabase
    .from('analysis_annotations')
    .select('*')
    .eq('analysis_id', params.id)
    .eq('user_id', user.id)

  if (sheetGuid) {
    query = query.eq('sheet_guid', sheetGuid)
  } else {
    query = query.is('sheet_guid', null)
  }

  const { data: annotation } = await query.maybeSingle()

  if (annotation) {
    return NextResponse.json({ annotation })
  }

  const { data: violations } = await supabase
    .from('violations')
    .select('*')
    .eq('analysis_id', params.id)
    .order('created_at', { ascending: true })

  const filtered = sheetGuid
    ? (violations ?? []).filter((v) => !v.sheet_guid || v.sheet_guid === sheetGuid)
    : (violations ?? [])

  const scene = buildViolationOverlayScene(filtered, 1200, 900)

  return NextResponse.json({
    annotation: null,
    generated_scene: scene,
  })
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: analysis } = await supabase
    .from('analyses')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
  }

  const body = (await request.json()) as {
    scene_json: Json
    sheet_guid?: string | null
  }

  if (!body.scene_json) {
    return NextResponse.json({ error: 'scene_json is required' }, { status: 400 })
  }

  const sheetGuid = body.sheet_guid ?? null

  const { data: existing } = await supabase
    .from('analysis_annotations')
    .select('id')
    .eq('analysis_id', params.id)
    .eq('user_id', user.id)
    .is('sheet_guid', sheetGuid)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from('analysis_annotations')
      .update({
        scene_json: body.scene_json,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ annotation: data })
  }

  const { data, error } = await supabase
    .from('analysis_annotations')
    .insert({
      analysis_id: params.id,
      user_id: user.id,
      sheet_guid: sheetGuid,
      scene_json: body.scene_json,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ annotation: data })
}
