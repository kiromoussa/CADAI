import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { interpretCodeSection } from '@/lib/analysis/code-interpreter'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    section?: string
    building_type?: string
    occupancy?: string
    jurisdiction?: string
  }

  if (!body.section?.trim()) {
    return NextResponse.json({ error: 'section required' }, { status: 400 })
  }

  try {
    const interpretation = await interpretCodeSection(body.section.trim(), {
      building_type: body.building_type,
      occupancy: body.occupancy,
      jurisdiction: body.jurisdiction,
    })
    return NextResponse.json({ interpretation })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Interpretation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
