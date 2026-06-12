'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { isAllowedAuthEmail, unauthorizedAuthMessage } from '@/lib/auth/allowed-users'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/dashboard'
  const authError = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(() => {
    if (authError === 'auth_callback_failed') {
      return 'Authentication failed. Please try again.'
    }
    if (authError === 'unauthorized') {
      return unauthorizedAuthMessage()
    }
    return null
  })
  const [loading, setLoading] = useState(false)

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!isAllowedAuthEmail(email)) {
      setError(unauthorizedAuthMessage())
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    if (!isAllowedAuthEmail(data.user?.email)) {
      await supabase.auth.signOut()
      setError(unauthorizedAuthMessage())
      setLoading(false)
      return
    }

    router.push(redirect)
    router.refresh()
  }

  async function handleGoogleLogin() {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`,
      },
    })

    if (oauthError) {
      setError(oauthError.message)
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy bg-grid-pattern bg-grid px-4">
      <div className="w-full max-w-md rounded-xl border border-blueprint bg-surface p-8">
        <p className="font-mono text-xs uppercase tracking-widest text-cyan">
          Sign in
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-offwhite">
          Welcome back
        </h1>

        <form onSubmit={handleEmailLogin} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block font-mono text-xs uppercase text-offwhite/50"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-blueprint bg-navy px-3 py-2.5 text-offwhite outline-none focus:border-cyan"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block font-mono text-xs uppercase text-offwhite/50"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-blueprint bg-navy px-3 py-2.5 text-offwhite outline-none focus:border-cyan"
            />
          </div>

          {error && (
            <p className="text-sm text-violation" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cyan py-2.5 font-medium text-white transition hover:bg-rust disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-blueprint" />
          <span className="font-mono text-xs text-offwhite/30">or</span>
          <div className="h-px flex-1 bg-blueprint" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full rounded-lg border border-blueprint py-2.5 text-offwhite/70 transition hover:border-cyan hover:text-cyan disabled:opacity-50"
        >
          Continue with Google
        </button>
      </div>
    </main>
  )
}
