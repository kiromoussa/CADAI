'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ProjectSetupModal } from '@/components/projects/ProjectSetupModal'
import {
  defaultProjectSetup,
  type ProjectSetupValues,
} from '@/lib/projects/constants'

export function NewBoardButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleCreate(values: ProjectSetupValues) {
    setBusy(true)
    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.name.trim() || 'Compliance board',
          default_city: values.city.trim(),
          default_state: values.state,
          default_project_type: values.projectType,
        }),
      })
      if (!res.ok) {
        setBusy(false)
        return
      }
      const { board } = (await res.json()) as { board: { id: string } }
      router.push(`/board/${board.id}`)
    } catch {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-cyan px-6 py-3 font-medium text-cyan transition hover:bg-cyan/10 disabled:opacity-50"
      >
        New board
      </button>
      <ProjectSetupModal
        open={open}
        title="New board"
        description="Name your board and set its location. New PDF and CAD uploads will use these as defaults."
        initialValues={defaultProjectSetup()}
        submitLabel="Create board"
        busy={busy}
        onClose={() => {
          if (!busy) setOpen(false)
        }}
        onSubmit={(values) => void handleCreate(values)}
      />
    </>
  )
}
