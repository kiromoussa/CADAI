import Link from 'next/link'
import { redirect } from 'next/navigation'
import { signOut } from '@/app/actions/auth'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, firm_name, aps_access_token')
    .eq('id', user.id)
    .single()

  return (
    <main className="min-h-screen bg-navy">
      <header className="border-b border-blueprint px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="font-mono text-sm text-cyan">
            CodeComply
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="font-mono text-sm text-offwhite/60 transition hover:text-cyan"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl font-semibold text-offwhite">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
        </h1>
        {profile?.firm_name && (
          <p className="mt-1 font-mono text-sm text-offwhite/60">
            {profile.firm_name}
          </p>
        )}

        {!profile?.aps_access_token && (
          <div className="mt-8 rounded-lg border border-blueprint bg-blueprint/20 p-6">
            <p className="font-mono text-xs uppercase text-cyan">
              Autodesk not connected
            </p>
            <p className="mt-2 text-offwhite/70">
              Connect your Autodesk account to analyze Revit models directly.
            </p>
          </div>
        )}

        <div className="mt-8">
          <p className="text-offwhite/60">
            Your projects will appear here once you run an analysis.
          </p>
        </div>
      </div>
    </main>
  )
}
