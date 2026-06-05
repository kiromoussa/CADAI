'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/dashboard'
  const authError = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(
    authError === 'auth_callback_failed'
      ? 'Authentication failed. Please try again.'
      : null
  )
  const [loading, setLoading] = useState(false)

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
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
      <div className="w-full max-w-md rounded-lg border border-blueprint bg-navy/80 p-8 backdrop-blur">
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
              className="block font-mono text-xs uppercase text-offwhite/60"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-blueprint bg-navy px-3 py-2 text-offwhite outline-none focus:border-cyan"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block font-mono text-xs uppercase text-offwhite/60"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border border-blueprint bg-navy px-3 py-2 text-offwhite outline-none focus:border-cyan"
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
            className="w-full rounded bg-cyan py-2.5 font-medium text-navy transition hover:bg-cyan/90 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-blueprint" />
          <span className="font-mono text-xs text-offwhite/40">or</span>
          <div className="h-px flex-1 bg-blueprint" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full rounded border border-blueprint py-2.5 text-offwhite transition hover:border-cyan hover:text-cyan disabled:opacity-50"
        >
          Continue with Google
        </button>

        <p className="mt-6 text-center text-sm text-offwhite/60">
          No account?{' '}
          <Link href="/signup" className="text-cyan hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  )
}
