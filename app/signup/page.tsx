'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [firmName, setFirmName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          firm_name: firmName,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  async function handleGoogleSignup() {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (oauthError) {
      setError(oauthError.message)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-navy px-4">
        <div className="w-full max-w-md rounded-lg border border-blueprint bg-navy/80 p-8 text-center">
          <h1 className="text-2xl font-semibold text-offwhite">
            Check your email
          </h1>
          <p className="mt-4 text-offwhite/70">
            We sent a confirmation link to <strong>{email}</strong>. Click it to
            activate your account.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-cyan hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy bg-grid-pattern bg-grid px-4">
      <div className="w-full max-w-md rounded-lg border border-blueprint bg-navy/80 p-8 backdrop-blur">
        <p className="font-mono text-xs uppercase tracking-widest text-cyan">
          Create account
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-offwhite">
          Start checking compliance
        </h1>

        <form onSubmit={handleSignup} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="fullName"
              className="block font-mono text-xs uppercase text-offwhite/60"
            >
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded border border-blueprint bg-navy px-3 py-2 text-offwhite outline-none focus:border-cyan"
            />
          </div>
          <div>
            <label
              htmlFor="firmName"
              className="block font-mono text-xs uppercase text-offwhite/60"
            >
              Firm name
            </label>
            <input
              id="firmName"
              type="text"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              className="mt-1 w-full rounded border border-blueprint bg-navy px-3 py-2 text-offwhite outline-none focus:border-cyan"
            />
          </div>
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
              minLength={8}
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
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-blueprint" />
          <span className="font-mono text-xs text-offwhite/40">or</span>
          <div className="h-px flex-1 bg-blueprint" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={loading}
          className="w-full rounded border border-blueprint py-2.5 text-offwhite transition hover:border-cyan hover:text-cyan disabled:opacity-50"
        >
          Continue with Google
        </button>

        <p className="mt-6 text-center text-sm text-offwhite/60">
          Already have an account?{' '}
          <Link href="/login" className="text-cyan hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
