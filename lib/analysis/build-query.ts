import type { Discipline, ExtractedProperties } from '@/types/analysis'
import { disciplineLabel } from '@/lib/analysis/disciplines'
import { appliesLaAduCorrectionList } from '@/lib/correction-lists/analysis-seed'

const DISCIPLINE_KEYWORDS: Partial<Record<Discipline, string[]>> = {
  electrical: [
    'branch circuits',
    'GFCI',
    'AFCI',
    'panel clearance',
    'outlet spacing',
    'receptacle',
    'lighting',
    'California Electrical Code',
  ],
  plumbing: [
    'DWV',
    'venting',
    'fixture units',
    'water supply',
    'drainage',
    'California Plumbing Code',
  ],
  mechanical: [
    'HVAC',
    'duct',
    'ventilation',
    'combustion air',
    'California Mechanical Code',
  ],
  fire: [
    'sprinkler',
    'fire alarm',
    'egress',
    'fire separation',
    'California Fire Code',
  ],
  structural: [
    'framing',
    'load bearing',
    'foundation',
    'shear wall',
    'California Building Code structural',
  ],
  roof: ['roof covering', 'slope', 'drainage', 'fire classification'],
  architectural: [
    'egress windows',
    'emergency escape',
    'rescue openings',
    'bedroom',
    'ceiling height',
    'stair dimensions',
    'door width',
    'garage separation',
    'fire rating',
    'California Residential Code',
  ],
  green: [
    'CALGreen',
    'energy efficiency',
    'solar ready',
    'water efficiency',
    'California Green Building Standards Code',
    'residential mandatory measures',
  ],
}

export function buildKeywordSearchQuery(
  context: { city: string; state: string; project_type: string },
  discipline: Discipline
): string {
  const keywords = DISCIPLINE_KEYWORDS[discipline] ?? DISCIPLINE_KEYWORDS.architectural
  const laAduHints =
    appliesLaAduCorrectionList(context.city, context.state, context.project_type) ?
      [
        'Los Angeles ADU JADU MTH plan check',
        'accessory dwelling unit zoning setbacks parking',
        'detached ADU attached JADU conversion',
      ]
    : []
  return [
    `${context.project_type} ${disciplineLabel(discipline)}`,
    `${context.city}, ${context.state}`,
    ...(keywords ?? []),
    ...laAduHints,
  ].join('\n')
}

export function buildSearchQuery(
  properties: ExtractedProperties,
  context: { city: string; state: string; project_type: string },
  options?: { discipline?: Discipline }
): string {
  const discipline = options?.discipline ?? 'architectural'
  const parts: string[] = [
    `${context.project_type} ${disciplineLabel(discipline)} code compliance`,
    `${context.city}, ${context.state}`,
  ]

  for (const room of (properties.rooms ?? []).slice(0, 12)) {
    const dims = [
      room.area_sqft != null ? `${room.area_sqft} sq ft` : null,
      room.ceiling_height_ft != null ? `${room.ceiling_height_ft} ft ceiling` : null,
    ]
      .filter(Boolean)
      .join(', ')
    parts.push(`Room ${room.name}${dims ? `: ${dims}` : ''}`)
  }

  for (const win of (properties.windows ?? []).slice(0, 10)) {
    parts.push(
      `Window ${win.name ?? ''}: ${win.width_in ?? '?'}in x ${win.height_in ?? '?'}in, sill ${win.sill_height_in ?? '?'}in`
    )
  }

  for (const door of (properties.doors ?? []).slice(0, 10)) {
    parts.push(
      `Door ${door.name ?? ''}: ${door.width_in ?? '?'}in x ${door.height_in ?? '?'}in`
    )
  }

  for (const stair of (properties.stairs ?? []).slice(0, 6)) {
    parts.push(
      `Stair ${stair.name ?? ''}: riser ${stair.riser_height_in ?? '?'}in, tread ${stair.tread_depth_in ?? '?'}in, width ${stair.width_in ?? '?'}in`
    )
  }

  if (properties.garage) {
    parts.push(
      `Garage attached=${properties.garage.attached ?? 'unknown'}, doors=${properties.garage.door_count ?? '?'}`
    )
  }

  const keywords = DISCIPLINE_KEYWORDS[discipline] ?? DISCIPLINE_KEYWORDS.architectural
  parts.push(...(keywords ?? []))

  return parts.join('\n')
}
