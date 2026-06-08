/** Canonical code_body values stored in Supabase (from chunk ingest). */
export const CODE_BODIES = {
  residential: 'California Residential Code',
  building: 'California Building Code',
  electrical: 'California Electrical Code',
  mechanical: 'California Mechanical Code',
  plumbing: 'California Plumbing Code',
  fire: 'California Fire Code',
  green: 'California Green Building Standards Code',
  municipal: 'Santa Ana Municipal Code',
} as const

export type CodeBodyName = (typeof CODE_BODIES)[keyof typeof CODE_BODIES]
