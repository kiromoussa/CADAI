import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { compareAnalysisVersions } from '@/lib/analysis/version-diff'
import type { ViolationRow } from '@/types/database'

export const runtime = 'nodejs'
export const maxDuration = 90

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    prior_analysis_id?: string
    current_analysis_id?: string
    prior_label?: string
    current_label?: string
  }

  if (!body.prior_analysis_id || !body.current_analysis_id) {
    return NextResponse.json(
      { error: 'prior_analysis_id and current_analysis_id required' },
      { status: 400 }
    )
  }

  const { data: analyses } = await supabase
    .from('analyses')
    .select('id')
    .eq('user_id', user.id)
    .in('id', [body.prior_analysis_id, body.current_analysis_id])

  if (!analyses || analyses.length !== 2) {
    return NextResponse.json({ error: 'Analyses not found' }, { status: 404 })
  }

  const { data: priorViolations } = await supabase
    .from('violations')
    .select('*')
    .eq('analysis_id', body.prior_analysis_id)

  const { data: currentViolations } = await supabase
    .from('violations')
    .select('*')
    .eq('analysis_id', body.current_analysis_id)

  try {
    const diff = await compareAnalysisVersions(
      (priorViolations ?? []) as ViolationRow[],
      (currentViolations ?? []) as ViolationRow[],
      {
        prior_label: body.prior_label,
        current_label: body.current_label,
      }
    )
    return NextResponse.json({ diff })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Version diff failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
