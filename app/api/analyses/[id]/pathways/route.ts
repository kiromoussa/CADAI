import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnalysisForUser } from '@/lib/analysis/analysis-access'
import { generateResolutionPathways } from '@/lib/analysis/resolution-pathways'
import type { ViolationRow } from '@/types/database'

export const runtime = 'nodejs'
export const maxDuration = 60

interface RouteParams {
  params: { id: string }
}

export async function POST(request: Request, { params }: RouteParams) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ctx = await getAnalysisForUser(params.id, user.id)
  if (!ctx) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
  }

  const body = (await request.json()) as { violation_id?: string }
  if (!body.violation_id) {
    return NextResponse.json({ error: 'violation_id required' }, { status: 400 })
  }

  const { data: violation } = await supabase
    .from('violations')
    .select('*')
    .eq('id', body.violation_id)
    .eq('analysis_id', params.id)
    .single()

  if (!violation) {
    return NextResponse.json({ error: 'Violation not found' }, { status: 404 })
  }

  try {
    const pathways = await generateResolutionPathways(violation as ViolationRow, {
      city: ctx.project.city,
      state: ctx.project.state,
      project_type: ctx.analysis.project_type,
    })
    return NextResponse.json({ pathways })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Pathway generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
