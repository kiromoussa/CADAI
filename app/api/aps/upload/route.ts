import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTwoLeggedToken } from '@/lib/aps/auth'
import {
  contentTypeForCad,
  isSupportedCadExtension,
  objectKeyForUpload,
  uploadObjectToOss,
} from '@/lib/aps/oss'
import { ensureModelTranslated, fileExtensionFromName } from '@/lib/aps/modelDerivative'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    project_id: string
    storage_path: string
    file_name: string
  }

  if (!body.project_id || !body.storage_path || !body.file_name) {
    return NextResponse.json(
      { error: 'project_id, storage_path, and file_name are required' },
      { status: 400 }
    )
  }

  if (!isSupportedCadExtension(body.file_name)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Use DWG, RVT, IFC, NWD, NWC, or DXF.' },
      { status: 400 }
    )
  }

  if (!body.storage_path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: 'Invalid storage path' }, { status: 403 })
  }

  try {
    const admin = createAdminClient()
    const { data: fileBlob, error: downloadError } = await admin.storage
      .from('floor-plans')
      .download(body.storage_path)

    if (downloadError || !fileBlob) {
      throw new Error(downloadError?.message ?? 'Failed to read uploaded file')
    }

    const buffer = Buffer.from(await fileBlob.arrayBuffer())
    const token = await getTwoLeggedToken()
    const objectKey = objectKeyForUpload(user.id, body.file_name)
    const { encodedUrn } = await uploadObjectToOss(
      token,
      objectKey,
      buffer,
      contentTypeForCad(body.file_name)
    )

    const translation = await ensureModelTranslated(encodedUrn, token, {
      fileExtension: fileExtensionFromName(body.file_name),
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
      })
      .eq('id', body.project_id)
      .eq('user_id', user.id)

    if (updateError) throw updateError

    return NextResponse.json({ urn: encodedUrn, status: translationStatus })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'CAD upload failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
