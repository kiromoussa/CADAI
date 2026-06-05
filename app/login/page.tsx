import { Suspense } from 'react'
import LoginForm from './LoginForm'

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-navy">
          <p className="font-mono text-cyan">Loading…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
