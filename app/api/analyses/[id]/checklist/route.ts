import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnalysisForUser } from '@/lib/analysis/analysis-access'
import { runChecklistReview } from '@/lib/analysis/checklist-review'
import type { ExtractedProperties } from '@/types/analysis'

export const runtime = 'nodejs'
export const maxDuration = 120

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
    items?: string[]
    checklist_name?: string
    plan_text?: string
  }

  if (!body.items?.length) {
    return NextResponse.json({ error: 'items array required' }, { status: 400 })
  }

  const planData =
    body.plan_text ??
    (ctx.analysis.extracted_properties as ExtractedProperties | null) ??
  'No plan data extracted — review based on available project metadata only.'

  try {
    const result = await runChecklistReview(
      body.items,
      planData,
      body.checklist_name ?? 'Custom QA/QC Checklist'
    )
    return NextResponse.json({ result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checklist review failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
