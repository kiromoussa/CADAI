import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnalysisForUser } from '@/lib/analysis/analysis-access'
import { computeReadinessScore } from '@/lib/analysis/readiness'

export const runtime = 'nodejs'

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

  const ctx = await getAnalysisForUser(params.id, user.id)
  if (!ctx) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
  }

  const { data: violations } = await supabase
    .from('violations')
    .select('*')
    .eq('analysis_id', params.id)

  const readiness = computeReadinessScore(violations ?? [])

  return NextResponse.json({ readiness })
}
