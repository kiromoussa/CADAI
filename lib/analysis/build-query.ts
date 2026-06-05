import type { ExtractedProperties } from '@/types/analysis'

export function buildSearchQuery(
  properties: ExtractedProperties,
  context: { city: string; state: string; project_type: string }
): string {
  const parts: string[] = [
    `${context.project_type} residential building code compliance`,
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

  parts.push(
    'California Residential Code egress windows emergency escape rescue openings bedroom ceiling height stair dimensions door width garage separation fire rating'
  )

  return parts.join('\n')
}
