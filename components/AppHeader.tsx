import Link from 'next/link'

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="border-b border-border px-6 py-4">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <div>
          <Link href="/dashboard" className="font-mono text-sm text-accent">
            CodeComply
          </Link>
          <h1 className="mt-1 text-xl font-semibold">{title}</h1>
          {subtitle && <p className="text-sm text-text-secondary">{subtitle}</p>}
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-text-secondary transition hover:text-text-primary"
        >
          Dashboard
        </Link>
      </div>
    </header>
  )
}
