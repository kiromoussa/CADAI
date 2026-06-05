import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTwoLeggedToken } from '@/lib/aps/auth'
import {
  contentTypeForCad,
  isSupportedCadExtension,
  objectKeyForUpload,
  prepareSignedUpload,
} from '@/lib/aps/oss'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as { file_name?: string }
  if (!body.file_name) {
    return NextResponse.json({ error: 'file_name is required' }, { status: 400 })
  }

  if (!isSupportedCadExtension(body.file_name)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Use DWG, RVT, IFC, NWD, NWC, or DXF.' },
      { status: 400 }
    )
  }

  try {
    const token = await getTwoLeggedToken()
    const objectKey = objectKeyForUpload(user.id, body.file_name)
    const session = await prepareSignedUpload(token, objectKey)

    return NextResponse.json({
      object_key: session.objectKey,
      upload_key: session.uploadKey,
      upload_urls: session.urls,
      content_type: contentTypeForCad(body.file_name),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to prepare upload'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
