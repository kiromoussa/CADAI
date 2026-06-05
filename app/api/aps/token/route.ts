import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTokenMeta } from '@/lib/aps/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const urn = new URL(request.url).searchParams.get('urn') ?? undefined

  try {
    const token = await getTokenMeta(user.id, urn)
    return NextResponse.json(token)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get APS token'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
