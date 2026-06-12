import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('canvas_boards')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ boards: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    title?: string
    default_city?: string
    default_state?: string
    default_project_type?: string
    project_id?: string
  }

  const { data, error } = await supabase
    .from('canvas_boards')
    .insert({
      user_id: user.id,
      title: body.title ?? 'Untitled board',
      default_city: body.default_city ?? 'Santa Ana',
      default_state: body.default_state ?? 'CA',
      default_project_type: body.default_project_type ?? 'residential',
      project_id: body.project_id ?? null,
      scene_json: { elements: [], appState: {}, files: {} } as Json,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ board: data })
}
