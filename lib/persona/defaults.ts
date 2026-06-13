/**
 * FirstPass persona-first defaults — tuned for small/mid architecture firms
 * doing mid-rise multifamily and mixed-use in key West Coast jurisdictions.
 */
export const FIRSTPASS_PERSONA = {
  tagline: 'AI that doesn’t just flag problems — it gets you to first-pass approval.',
  targetFirms: '5–50 person architecture firms',
  projectTypes: ['multifamily', 'mixed-use', 'adu'] as const,
  primaryStates: ['CA', 'OR', 'WA', 'NV', 'AZ'] as const,
  defaultCity: 'Los Angeles',
  defaultState: 'CA',
  defaultProjectType: 'multifamily',
} as const

export const PERSONA_PROJECT_TYPES = [
  { value: 'multifamily', label: 'Mid-rise multifamily' },
  { value: 'mixed-use', label: 'Mixed-use' },
  { value: 'adu', label: 'ADU / infill' },
  { value: 'residential', label: 'Single-family residential' },
  { value: 'commercial', label: 'Commercial' },
] as const

export const PERSONA_JURISDICTIONS = [
  { city: 'Los Angeles', state: 'CA' },
  { city: 'Santa Ana', state: 'CA' },
  { city: 'San Diego', state: 'CA' },
  { city: 'Oakland', state: 'CA' },
  { city: 'Portland', state: 'OR' },
  { city: 'Seattle', state: 'WA' },
] as const

export const DEFAULT_CHECKLIST_ITEMS = [
  'Egress paths dimensioned and continuous on all floor plans',
  'Fire-rated corridor and stair assemblies labeled at transitions',
  'Accessible routes from public entrances to all dwelling units',
  'Window schedule includes egress sizing and sill heights per unit type',
  'Title 24 energy compliance path documented on cover sheet',
  'Trash/recycling and bicycle parking per local multifamily ordinance',
] as const
