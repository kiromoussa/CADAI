import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUrl, getCallbackUrl } from '@/lib/aps/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const callbackUrl = getCallbackUrl(request)
  return NextResponse.redirect(getAuthUrl(user.id, callbackUrl))
}
