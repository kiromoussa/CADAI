export const US_STATES = ['CA', 'AZ', 'NV', 'OR', 'WA', 'TX', 'FL', 'NY'] as const

export const PROJECT_TYPES = [
  'residential',
  'adu',
  'multifamily',
  'commercial',
] as const

export type ProjectSetupValues = {
  name: string
  city: string
  state: string
  projectType: string
}

export function defaultProjectSetup(
  overrides?: Partial<ProjectSetupValues>
): ProjectSetupValues {
  return {
    name: overrides?.name ?? '',
    city: overrides?.city ?? 'Santa Ana',
    state: overrides?.state ?? 'CA',
    projectType: overrides?.projectType ?? 'residential',
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
