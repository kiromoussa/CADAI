'use client'

import { hasLocalCode } from '@/lib/jurisdiction'
import { PROJECT_TYPES, US_STATES, type ProjectSetupValues } from '@/lib/projects/constants'

export function ProjectSetupFields({
  values,
  onChange,
  showName = true,
}: {
  values: ProjectSetupValues
  onChange: (patch: Partial<ProjectSetupValues>) => void
  showName?: boolean
}) {
  return (
    <div className="space-y-4">
      {showName && (
        <Field label="Project name">
          <input
            value={values.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="input-field"
            placeholder="123 Main St ADU"
          />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Field label="City">
          <input
            value={values.city}
            onChange={(e) => onChange({ city: e.target.value })}
            className="input-field"
          />
          {hasLocalCode(values.city, values.state) ? (
            <p className="mt-1 text-xs text-severity-pass">
              Local municipal code available for this city.
            </p>
          ) : (
            <p className="mt-1 text-xs text-text-secondary">
              State building code will be used (no local code ingested for this city yet).
            </p>
          )}
        </Field>
        <Field label="State">
          <select
            value={values.state}
            onChange={(e) => onChange({ state: e.target.value })}
            className="input-field"
          >
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Project type">
        <select
          value={values.projectType}
          onChange={(e) => onChange({ projectType: e.target.value })}
          className="input-field"
        >
          {PROJECT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-text-primary">{label}</span>
      {children}
    </label>
  )
}
