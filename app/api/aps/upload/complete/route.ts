import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTwoLeggedToken } from '@/lib/aps/auth'
import { completeSignedUpload, isSupportedCadExtension } from '@/lib/aps/oss'
import { ensureModelTranslated, fileExtensionFromName } from '@/lib/aps/modelDerivative'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    project_id?: string
    object_key?: string
    upload_key?: string
    file_name?: string
    force?: boolean
  }

  if (!body.project_id || !body.object_key || !body.upload_key || !body.file_name) {
    return NextResponse.json(
      { error: 'project_id, object_key, upload_key, and file_name are required' },
      { status: 400 }
    )
  }

  if (!isSupportedCadExtension(body.file_name)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Use DWG, RVT, IFC, NWD, NWC, or DXF.' },
      { status: 400 }
    )
  }

  const expectedPrefix = `${user.id}-`
  if (!body.object_key.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: 'Invalid object key' }, { status: 403 })
  }

  try {
    const token = await getTwoLeggedToken()
    const { encodedUrn } = await completeSignedUpload(
      token,
      body.object_key,
      body.upload_key
    )

    const fileExtension = fileExtensionFromName(body.file_name)
    const translationStartedAt = new Date().toISOString()

    const translation = await ensureModelTranslated(encodedUrn, token, {
      force: body.force,
      fileExtension,
    })

    const translationStatus =
      translation === 'complete' ? 'complete' : 'processing'

    const { error: updateError } = await supabase
      .from('projects')
      .update({
        aps_urn: encodedUrn,
        aps_hub_id: null,
        aps_project_id: null,
        aps_item_id: null,
        translation_status: translationStatus,
        source_type: 'aps',
        original_file_name: body.file_name,
        translation_started_at: translationStartedAt,
        translation_force_retried: false,
        translation_force_retried_at: null,
      })
      .eq('id', body.project_id)
      .eq('user_id', user.id)

    if (updateError) throw updateError

    return NextResponse.json({
      urn: encodedUrn,
      status: translationStatus,
      translation,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'CAD upload failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
