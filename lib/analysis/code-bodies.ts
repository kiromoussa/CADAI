/** Canonical code_body values stored in Supabase (from chunk ingest). */
export const CODE_BODIES = {
  residential: 'California Residential Code',
  building: 'California Building Code',
  electrical: 'California Electrical Code',
  mechanical: 'California Mechanical Code',
  plumbing: 'California Plumbing Code',
  fire: 'California Fire Code',
  green: 'California Green Building Standards Code',
} as const

export type CodeBodyName = (typeof CODE_BODIES)[keyof typeof CODE_BODIES]

/** Municipal code_body per local jurisdiction slug (from chunk ingest). */
export const MUNICIPAL_CODE_BODIES: Record<string, string> = {
  santa_ana_ca: 'Santa Ana Municipal Code',
  los_angeles_ca: 'Los Angeles Municipal Code',
}

export function municipalCodeBodyForJurisdiction(jurisdiction: string): string | null {
  return MUNICIPAL_CODE_BODIES[jurisdiction] ?? null
}
