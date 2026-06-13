import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnalysisForUser } from '@/lib/analysis/analysis-access'
import type { Json } from '@/types/database'

export const runtime = 'nodejs'

interface RouteParams {
  params: { id: string; violationId: string }
}

export async function PATCH(request: Request, { params }: RouteParams) {
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
    accepted_pathway?: Record<string, unknown> | null
    pathway_option?: number
  }

  const { data: violation } = await supabase
    .from('violations')
    .select('*')
    .eq('id', params.violationId)
    .eq('analysis_id', params.id)
    .single()

  if (!violation) {
    return NextResponse.json({ error: 'Violation not found' }, { status: 404 })
  }

  let accepted_pathway = body.accepted_pathway ?? null

  if (body.pathway_option != null && violation.resolution_pathways) {
    const pathways = violation.resolution_pathways as Array<Record<string, unknown>>
    accepted_pathway =
      pathways.find((p) => p.option === body.pathway_option) ?? accepted_pathway
  }

  const { data, error } = await supabase
    .from('violations')
    .update({
      accepted_pathway: accepted_pathway as Json,
    })
    .eq('id', params.violationId)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ violation: data })
}
