import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    name: string
    city: string
    state: string
    project_type: string
    source_type: 'pdf' | 'aps'
    pdf_storage_path?: string
    aps_urn?: string
    aps_hub_id?: string
    aps_project_id?: string
    aps_item_id?: string
  }

  if (!body.name || !body.city || !body.state || !body.source_type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name: body.name,
      city: body.city,
      state: body.state,
      project_type: body.project_type ?? 'residential',
      source_type: body.source_type,
      pdf_storage_path: body.pdf_storage_path ?? null,
      aps_urn: body.aps_urn ?? null,
      aps_hub_id: body.aps_hub_id ?? null,
      aps_project_id: body.aps_project_id ?? null,
      aps_item_id: body.aps_item_id ?? null,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ project_id: data.id })
}
