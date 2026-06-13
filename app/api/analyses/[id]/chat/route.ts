import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnalysisForUser } from '@/lib/analysis/analysis-access'
import { askPlanQuestion, type PlanChatMessage } from '@/lib/analysis/plan-chat'
import type { ExtractedProperties } from '@/types/analysis'

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

  const body = (await request.json()) as {
    question?: string
    history?: PlanChatMessage[]
  }

  if (!body.question?.trim()) {
    return NextResponse.json({ error: 'question required' }, { status: 400 })
  }

  const { data: violations } = await supabase
    .from('violations')
    .select('*')
    .eq('analysis_id', params.id)

  try {
    const response = await askPlanQuestion(body.question.trim(), {
      city: ctx.project.city,
      state: ctx.project.state,
      project_type: ctx.analysis.project_type,
      properties: ctx.analysis.extracted_properties as ExtractedProperties | null,
      violations: violations ?? [],
      history: body.history,
    })
    return NextResponse.json({ response })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Chat failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
