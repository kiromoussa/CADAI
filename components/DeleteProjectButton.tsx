'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = {
  projectId: string
  projectName: string
}

export function DeleteProjectButton({ projectId, projectName }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${projectName}"?\n\nThis removes the project, all analysis results, and any PDF floor plan stored in Supabase. CAD files uploaded to Autodesk are not removed. This cannot be undone.`
    )
    if (!confirmed) return

    setBusy(true)
    setError(null)

    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        throw new Error(data.error ?? 'Delete failed')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="rounded-md border border-severity-violation/40 px-4 py-2 text-sm text-severity-violation transition hover:bg-severity-violation/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Deleting…' : 'Delete'}
      </button>
      {error && <p className="max-w-xs text-right text-xs text-severity-violation">{error}</p>}
    </div>
  )
}
