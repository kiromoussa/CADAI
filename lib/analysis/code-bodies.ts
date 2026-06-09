import { localJurisdictionForCity } from '@/lib/jurisdiction'

/** Canonical California state code_body values (from chunk ingest). */
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

/**
 * Municipal code_body values per jurisdiction slug (must match Supabase ingest).
 * los_angeles_ca: LAMC ingested on main; additional LA codes listed for future ingest.
 */
export const MUNICIPAL_CODE_BODIES: Record<string, string[]> = {
  santa_ana_ca: ['Santa Ana Municipal Code'],
  los_angeles_ca: [
    'Los Angeles Municipal Code',
    'Los Angeles Building Code',
    'Los Angeles Residential Code',
    'Los Angeles Plumbing Code',
    'Los Angeles Mechanical Code',
    'Los Angeles Electrical Code',
    'Los Angeles Fire Code',
    'Los Angeles Green Building Standards Code',
  ],
}

export function municipalCodeBodiesForJurisdiction(jurisdiction: string): string[] {
  return MUNICIPAL_CODE_BODIES[jurisdiction] ?? []
}

/** Primary municipal code_body for a jurisdiction (first entry). */
export function municipalCodeBodyForJurisdiction(jurisdiction: string): string | null {
  const bodies = municipalCodeBodiesForJurisdiction(jurisdiction)
  return bodies[0] ?? null
}

export function municipalCodeBodiesForCity(city: string, state: string): string[] {
  const slug = localJurisdictionForCity(city, state)
  if (!slug) return []
  return municipalCodeBodiesForJurisdiction(slug)
}
