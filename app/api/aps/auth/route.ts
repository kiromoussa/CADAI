import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  decodeOAuthState,
  exchangeCode,
  getAuthUrl,
  getCallbackUrl,
  storeTokensForUser,
} from '@/lib/aps/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const fallbackAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? getCallbackUrl(request).replace(/\/api\/aps\/auth$/, '')

  if (error) {
    return NextResponse.redirect(
      `${fallbackAppUrl}/analyze?aps_error=${encodeURIComponent(error)}`
    )
  }

  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 })
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${fallbackAppUrl}/login?redirect=/analyze`)
  }

  const oauthState = state ? decodeOAuthState(state) : null
  if (!oauthState || oauthState.uid !== user.id) {
    return NextResponse.redirect(`${fallbackAppUrl}/analyze?aps_error=invalid_state`)
  }

  const appUrl = oauthState.cb.replace(/\/api\/aps\/auth$/, '')

  try {
    const tokens = await exchangeCode(code, oauthState.cb)
    await storeTokensForUser(user.id, tokens)
    return NextResponse.redirect(`${appUrl}/analyze?aps_connected=1`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth failed'
    return NextResponse.redirect(
      `${appUrl}/analyze?aps_error=${encodeURIComponent(message)}`
    )
  }
}

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const callbackUrl = getCallbackUrl(request)
  const url = getAuthUrl(user.id, callbackUrl)
  return NextResponse.json({ url, callback_url: callbackUrl })
}
