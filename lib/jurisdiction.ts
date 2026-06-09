/** Jurisdiction slugs that have local municipal code ingested in Supabase. */
export const LOCAL_CODE_JURISDICTIONS = new Set<string>(['santa_ana_ca', 'los_angeles_ca'])

function normalizeCity(city: string): string {
  return city.trim().toLowerCase()
}

function normalizeState(state: string): string {
  return state.trim().toLowerCase()
}

function isCalifornia(state: string): boolean {
  const s = normalizeState(state)
  return s === 'ca' || s === 'california'
}

/** Local municipal slug, or null if none is mapped for this city. */
export function localJurisdictionForCity(city: string, state: string): string | null {
  if (!isCalifornia(state)) return null
  const c = normalizeCity(city)
  if (c.includes('santa ana')) return 'santa_ana_ca'
  if (c.includes('los angeles') || c === 'la') return 'los_angeles_ca'
  return null
}

/** Primary state-level code slug for search. */
export function stateJurisdictionForState(state: string): string {
  if (isCalifornia(state)) return 'california'
  const s = normalizeState(state)
  return `${s}_state`
}

/**
 * Ordered list of jurisdictions to search (local first, then state).
 * Only includes local slugs that have ingested code in Supabase.
 */
export function searchJurisdictionsForCity(city: string, state: string): string[] {
  const jurisdictions: string[] = []
  const local = localJurisdictionForCity(city, state)
  if (local && LOCAL_CODE_JURISDICTIONS.has(local)) {
    jurisdictions.push(local)
  }
  const stateSlug = stateJurisdictionForState(state)
  if (!jurisdictions.includes(stateSlug)) {
    jurisdictions.push(stateSlug)
  }
  return jurisdictions
}

/** Primary jurisdiction label stored on analyses / used for display. */
export function jurisdictionForCity(city: string, state: string): string {
  const local = localJurisdictionForCity(city, state)
  if (local && LOCAL_CODE_JURISDICTIONS.has(local)) return local
  return stateJurisdictionForState(state)
}

export function hasLocalCode(city: string, state: string): boolean {
  const local = localJurisdictionForCity(city, state)
  return local != null && LOCAL_CODE_JURISDICTIONS.has(local)
}
