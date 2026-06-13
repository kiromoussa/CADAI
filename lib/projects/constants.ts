export const US_STATES = ['CA', 'OR', 'WA', 'NV', 'AZ', 'TX', 'FL', 'NY'] as const

export const PROJECT_TYPES = [
  'multifamily',
  'mixed-use',
  'adu',
  'residential',
  'commercial',
] as const

export type ProjectSetupValues = {
  name: string
  city: string
  state: string
  projectType: string
}

import { FIRSTPASS_PERSONA } from '@/lib/persona/defaults'

export function defaultProjectSetup(
  overrides?: Partial<ProjectSetupValues>
): ProjectSetupValues {
  return {
    name: overrides?.name ?? '',
    city: overrides?.city ?? FIRSTPASS_PERSONA.defaultCity,
    state: overrides?.state ?? FIRSTPASS_PERSONA.defaultState,
    projectType: overrides?.projectType ?? FIRSTPASS_PERSONA.defaultProjectType,
  }
}

export function projectSetupFromFileName(
  fileName: string,
  boardDefaults?: Partial<ProjectSetupValues>
): ProjectSetupValues {
  const base = fileName.replace(/\.[^.]+$/, '')
  return defaultProjectSetup({
    name: base,
    city: boardDefaults?.city,
    state: boardDefaults?.state,
    projectType: boardDefaults?.projectType,
  })
}
