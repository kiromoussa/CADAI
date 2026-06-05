import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-navy bg-grid-pattern bg-grid">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">
        <p className="font-mono text-sm uppercase tracking-widest text-cyan">
          CodeComply
        </p>
        <h1 className="mt-4 text-4xl font-semibold text-offwhite md:text-5xl">
          Code compliance that works inside your workflow
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-offwhite/70">
          Upload a floor plan or connect Autodesk. Get a plain-English
          compliance report in under 60 seconds.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="/signup"
            className="rounded-md bg-cyan px-6 py-3 font-medium text-navy transition hover:bg-cyan/90"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-blueprint px-6 py-3 font-medium text-offwhite transition hover:border-cyan hover:text-cyan"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  )
}
