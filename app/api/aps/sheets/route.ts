import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTokenForUrn } from '@/lib/aps/auth'
import { listSheetViews } from '@/lib/aps/modelDerivative'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = new URL(request.url).searchParams
  const urn = params.get('urn')
  const projectId = params.get('project_id')

  if (!urn) {
    return NextResponse.json({ error: 'urn is required' }, { status: 400 })
  }

  if (projectId) {
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
  }

  try {
    const token = await getTokenForUrn(user.id, urn)
    const sheets = await listSheetViews(urn, token)
    return NextResponse.json({ sheets })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list sheets'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
