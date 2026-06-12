'use client'

import { useEffect, useState } from 'react'
import type { ProjectSetupValues } from '@/lib/projects/constants'
import { ProjectSetupFields } from '@/components/projects/ProjectSetupFields'

interface ProjectSetupModalProps {
  open: boolean
  title: string
  description?: string
  file?: File | null
  initialValues: ProjectSetupValues
  submitLabel?: string
  busy?: boolean
  onClose: () => void
  onSubmit: (values: ProjectSetupValues) => void
}

export function ProjectSetupModal({
  open,
  title,
  description,
  file,
  initialValues,
  submitLabel = 'Continue',
  busy = false,
  onClose,
  onSubmit,
}: ProjectSetupModalProps) {
  const [values, setValues] = useState(initialValues)

  useEffect(() => {
    if (open) setValues(initialValues)
  }, [open, initialValues])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={() => {
        if (!busy) onClose()
      }}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-surface p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-setup-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="project-setup-title" className="text-lg font-semibold text-text-primary">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        )}
        {file && (
          <div className="mt-4 rounded-md border border-border bg-background/40 px-3 py-2 text-sm text-text-primary">
            {file.name}
            {file.size > 80 * 1024 * 1024 && (
              <p className="mt-1 text-xs text-severity-warning">
                Large file ({formatFileSize(file.size)}) - translation may take 10+ minutes.
              </p>
            )}
          </div>
        )}
        <div className="mt-4">
          <ProjectSetupFields
            values={values}
            onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
          />
        </div>
        {file && (
          <p className="mt-3 text-xs text-text-secondary">
            Upload goes straight to Autodesk (not through our servers). We translate 2D sheet
            views (floor plans); DWG and IFC are fastest.
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !values.name.trim() || !values.city.trim() || !values.state}
            onClick={() => onSubmit(values)}
            className="btn-primary flex-1"
          >
            {busy ? 'Working…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
