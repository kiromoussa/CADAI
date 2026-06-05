import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { apsFetch } from '@/lib/aps/fetch'
import { isAppOssUrn } from '@/lib/aps/oss'

const APS_AUTH_URL = 'https://developer.api.autodesk.com/authentication/v2/authorize'
const APS_TOKEN_URL = 'https://developer.api.autodesk.com/authentication/v2/token'
const APS_SCOPES =
  'data:read data:write data:create bucket:read bucket:create viewables:read'

const APS_TWO_LEGGED_SCOPES =
  'data:read data:write data:create bucket:read bucket:create viewables:read'

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000

let cachedTwoLegged: { token: string; expiresAt: number } | null = null

interface OAuthStatePayload {
  uid: string
  cb: string
}

function apsCredentials() {
  const clientId = process.env.APS_CLIENT_ID
  const clientSecret = process.env.APS_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('APS OAuth is not configured (APS_CLIENT_ID / APS_CLIENT_SECRET)')
  }

  return { clientId, clientSecret }
}

/** OAuth callback URL — must match a URL registered in the APS app portal. */
export function getCallbackUrl(request?: Request): string {
  if (request) {
    return new URL('/api/aps/auth', request.url).href
  }

  if (process.env.APS_CALLBACK_URL) {
    return process.env.APS_CALLBACK_URL
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  return `${appUrl}/api/aps/auth`
}

export function encodeOAuthState(userId: string, callbackUrl: string): string {
  const payload: OAuthStatePayload = { uid: userId, cb: callbackUrl }
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export function decodeOAuthState(state: string): OAuthStatePayload | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(state, 'base64url').toString('utf8')
    ) as OAuthStatePayload
    if (parsed?.uid && parsed?.cb) return parsed
  } catch {
    // Legacy state was the raw user id string.
    if (state) {
      return { uid: state, cb: getCallbackUrl() }
    }
  }
  return null
}

export function getAuthUrl(userId: string, callbackUrl: string): string {
  const { clientId } = apsCredentials()
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: APS_SCOPES,
    state: encodeOAuthState(userId, callbackUrl),
  })
  return `${APS_AUTH_URL}?${params.toString()}`
}

async function tokenRequest(body: Record<string, string>) {
  const { clientId, clientSecret } = apsCredentials()
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await apsFetch(APS_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`APS token exchange failed (${response.status}): ${text}`)
  }

  return response.json() as Promise<{
    access_token: string
    refresh_token: string
    expires_in: number
  }>
}

export async function exchangeCode(code: string, callbackUrl: string) {
  return tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl,
  })
}

export async function refreshApsToken(refreshToken: string) {
  return tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
}

export async function storeTokensForUser(
  userId: string,
  tokens: { access_token: string; refresh_token: string; expires_in: number }
) {
  const admin = createAdminClient()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  const { error } = await admin
    .from('profiles')
    .update({
      aps_access_token: tokens.access_token,
      aps_refresh_token: tokens.refresh_token,
      aps_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (error) throw error
}

export async function getValidToken(userId: string): Promise<string> {
  const supabase = createClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('aps_access_token, aps_refresh_token, aps_token_expires_at')
    .eq('id', userId)
    .single()

  if (error || !profile?.aps_access_token) {
    throw new Error('Autodesk account not connected')
  }

  const expiresAt = profile.aps_token_expires_at
    ? new Date(profile.aps_token_expires_at).getTime()
    : 0

  if (expiresAt - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
    return profile.aps_access_token
  }

  if (!profile.aps_refresh_token) {
    throw new Error('APS refresh token missing — reconnect Autodesk')
  }

  const tokens = await refreshApsToken(profile.aps_refresh_token)
  await storeTokensForUser(userId, tokens)
  return tokens.access_token
}

/** App-only token for OSS upload, translation, and viewer (no user Autodesk login). */
export async function getTwoLeggedToken(): Promise<string> {
  if (
    cachedTwoLegged &&
    cachedTwoLegged.expiresAt - Date.now() > TOKEN_REFRESH_BUFFER_MS
  ) {
    return cachedTwoLegged.token
  }

  const tokens = await tokenRequest({
    grant_type: 'client_credentials',
    scope: APS_TWO_LEGGED_SCOPES,
  })

  cachedTwoLegged = {
    token: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  }

  return tokens.access_token
}

/** User OAuth token when connected; otherwise server credentials (uploaded CAD models). */
export async function getModelAccessToken(userId: string): Promise<string> {
  try {
    return await getValidToken(userId)
  } catch {
    return getTwoLeggedToken()
  }
}

/** Pick the token that owns this model (app OSS vs ACC/BIM 360). */
export async function getTokenForUrn(userId: string, encodedUrn: string): Promise<string> {
  if (isAppOssUrn(encodedUrn)) {
    return getTwoLeggedToken()
  }
  return getModelAccessToken(userId)
}

export async function getTokenMeta(userId: string, encodedUrn?: string) {
  let accessToken: string
  let expiresIn = 3600

  const useAppToken = encodedUrn ? isAppOssUrn(encodedUrn) : false

  if (useAppToken) {
    accessToken = await getTwoLeggedToken()
    if (cachedTwoLegged) {
      expiresIn = Math.max(
        0,
        Math.floor((cachedTwoLegged.expiresAt - Date.now()) / 1000)
      )
    }
  } else {
    try {
      accessToken = await getValidToken(userId)
      const supabase = createClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('aps_token_expires_at')
        .eq('id', userId)
        .single()

      if (profile?.aps_token_expires_at) {
        expiresIn = Math.max(
          0,
          Math.floor((new Date(profile.aps_token_expires_at).getTime() - Date.now()) / 1000)
        )
      }
    } catch {
      accessToken = await getTwoLeggedToken()
      if (cachedTwoLegged) {
        expiresIn = Math.max(
          0,
          Math.floor((cachedTwoLegged.expiresAt - Date.now()) / 1000)
        )
      }
    }
  }

  return {
    access_token: accessToken,
    expires_in: expiresIn,
  }
}
