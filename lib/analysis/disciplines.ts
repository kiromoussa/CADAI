import type { Discipline, ExtractedProperties } from '@/types/analysis'
import { CODE_BODIES } from '@/lib/analysis/code-bodies'

export type { Discipline }

export const DISCIPLINE_CODE_BODIES: Record<Discipline, string[]> = {
  architectural: [CODE_BODIES.residential, CODE_BODIES.building],
  structural: [CODE_BODIES.building, CODE_BODIES.residential],
  roof: [CODE_BODIES.building, CODE_BODIES.residential],
  electrical: [CODE_BODIES.electrical],
  plumbing: [CODE_BODIES.plumbing],
  mechanical: [CODE_BODIES.mechanical],
  fire: [CODE_BODIES.fire, CODE_BODIES.residential, CODE_BODIES.building],
  green: [CODE_BODIES.green, CODE_BODIES.residential],
  general: [CODE_BODIES.residential, CODE_BODIES.building],
}

const DISCIPLINE_PATTERNS: Array<{ discipline: Discipline; pattern: RegExp }> = [
  { discipline: 'electrical', pattern: /\b(elec|electrical|power|lighting|panel|circuit|outlet|receptacle|^e[\s.-]\d)/i },
  { discipline: 'plumbing', pattern: /\b(plumb|plumbing|sanitary|water|dwv|drain|sewer|fixture|^p[\s.-]\d)/i },
  { discipline: 'mechanical', pattern: /\b(mech|mechanical|hvac|duct|ventilation|air\s*cond|^m[\s.-]\d)/i },
  { discipline: 'fire', pattern: /\b(fire|sprinkler|alarm|life\s*safety|^fp[\s.-]|life\s*safety)/i },
  { discipline: 'structural', pattern: /\b(struct|structural|framing|foundation|footing|beam|column|truss|rafter|^s[\s.-]\d)/i },
  { discipline: 'roof', pattern: /\b(roof|roofing|ridge|soffit|fascia)/i },
  { discipline: 'green', pattern: /\b(green|solar|calgreen|energy|sustain)/i },
  { discipline: 'architectural', pattern: /\b(arch|floor\s*plan|elevation|section|site|layout|reflected|^a[\s.-]\d|plan\s*\d)/i },
]

const RESIDENTIAL_PROJECT_TYPES = new Set(['residential', 'adu', 'single-family', 'single family'])

export function inferDiscipline(sheetName: string, layerNames: string[] = []): Discipline {
  const haystack = [sheetName, ...layerNames].join(' ').toLowerCase()

  for (const { discipline, pattern } of DISCIPLINE_PATTERNS) {
    if (pattern.test(haystack)) return discipline
  }

  return 'general'
}

export function disciplineLabel(discipline: Discipline): string {
  const labels: Record<Discipline, string> = {
    architectural: 'Architectural',
    structural: 'Structural',
    roof: 'Roof',
    electrical: 'Electrical',
    plumbing: 'Plumbing',
    mechanical: 'Mechanical',
    fire: 'Fire / Life Safety',
    green: 'Green / Energy',
    general: 'General',
  }
  return labels[discipline]
}

function sheetEntityCount(sheet: {
  rooms: unknown[]
  windows: unknown[]
  doors: unknown[]
  stairs: unknown[]
}): number {
  return (
    sheet.rooms.length +
    sheet.windows.length +
    sheet.doors.length +
    sheet.stairs.length
  )
}

function isResidentialProject(projectType: string): boolean {
  return RESIDENTIAL_PROJECT_TYPES.has(projectType.trim().toLowerCase())
}

/** Map untagged floor-plan sheets to disciplines we can review. */
function addDisciplineFromSheet(found: Set<Discipline>, discipline: Discipline) {
  if (discipline === 'general') {
    found.add('architectural')
    found.add('fire')
    return
  }
  found.add(discipline)
}

export function disciplinesWithContent(
  properties: {
    sheets?: Array<{ discipline: Discipline; rooms: unknown[]; windows: unknown[]; doors: unknown[]; stairs: unknown[] }>
    rooms: unknown[]
    windows: unknown[]
    doors: unknown[]
    stairs: unknown[]
    garage?: unknown
  },
  projectType?: string
): Discipline[] {
  const found = new Set<Discipline>()

  if (properties.sheets?.length) {
    for (const sheet of properties.sheets) {
      if (sheetEntityCount(sheet) > 0) {
        addDisciplineFromSheet(found, sheet.discipline)
      }
    }
  } else {
    const total = sheetEntityCount(properties)
    if (total > 0) found.add('architectural')
  }

  if (projectType && isResidentialProject(projectType) && found.has('architectural')) {
    found.add('fire')
    found.add('green')
  }

  if (properties.garage && isResidentialProject(projectType ?? 'residential')) {
    found.add('fire')
  }

  const order: Discipline[] = [
    'architectural',
    'structural',
    'roof',
    'fire',
    'green',
    'electrical',
    'plumbing',
    'mechanical',
    'general',
  ]
  return order.filter((d) => found.has(d))
}

export function slicePropertiesByDiscipline(
  properties: ExtractedProperties,
  discipline: Discipline
): ExtractedProperties {
  const match = (item: { discipline?: Discipline }) =>
    !item.discipline || item.discipline === discipline || item.discipline === 'general'

  const sliced: ExtractedProperties = {
    ...properties,
    rooms: properties.rooms.filter(match),
    windows: properties.windows.filter(match),
    doors: properties.doors.filter(match),
    stairs: properties.stairs.filter(match),
    garage: properties.garage && match(properties.garage) ? properties.garage : undefined,
    sheets: properties.sheets?.filter((s) => s.discipline === discipline || (discipline === 'architectural' && s.discipline === 'general')),
  }

  const entityCount = sheetEntityCount(sliced)
  if (entityCount === 0 && (discipline === 'fire' || discipline === 'green')) {
    return {
      ...properties,
      sheets: properties.sheets,
    }
  }

  return sliced
}
