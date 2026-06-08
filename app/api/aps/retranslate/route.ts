import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTokenForUrn } from '@/lib/aps/auth'
import {
  fileExtensionFromName,
  translateModel,
} from '@/lib/aps/modelDerivative'

export const dynamic = 'force-dynamic'

/** Force SVF2 legacy 2D re-translation (fixes viewer after PDF-only sheet export). */
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as { project_id?: string }
  if (!body.project_id) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('aps_urn, original_file_name')
    .eq('id', body.project_id)
    .eq('user_id', user.id)
    .single()

  if (projectError || !project?.aps_urn) {
    return NextResponse.json({ error: 'Project or APS URN not found' }, { status: 404 })
  }

  try {
    const token = await getTokenForUrn(user.id, project.aps_urn)
    const fileExtension = project.original_file_name
      ? fileExtensionFromName(project.original_file_name)
      : undefined
    const startedAt = new Date().toISOString()

    await translateModel(project.aps_urn, token, {
      force: true,
      fileExtension,
    })

    await supabase
      .from('projects')
      .update({
        translation_status: 'processing',
        translation_started_at: startedAt,
        translation_force_retried: true,
        translation_force_retried_at: startedAt,
      })
      .eq('id', body.project_id)
      .eq('user_id', user.id)

    return NextResponse.json({ status: 'processing' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Retranslation failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
