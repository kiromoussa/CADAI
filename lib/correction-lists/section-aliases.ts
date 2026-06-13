/**
 * Maps 2023 LABC/LARC section refs (used on PC.STR.Corr.Lst.20A) to 2025 CRC/CBC equivalents
 * in our ingested code chunks.
 */
const EXACT_ALIASES: Record<string, string> = {
  // 2023 LARC egress / stairs → 2025 CRC (R311 block repurposed for CO; egress is R318)
  'R311.1': 'R318.1',
  'R311.2': 'R318.2',
  'R311.3': 'R318.3',
  'R311.7': 'R318.7',
  'R311.7.1': 'R318.7.1',
  'R311.7.2': 'R318.7.2',
  'R311.7.5': 'R318.7.5',
  'R311.7.8.1': 'R318.7.8.1',
  'R311.7.8.3': 'R318.7.8.3',
  'R311.8.1': 'R320.1',
  // 2023 LARC EERO → 2025 CRC R319
  'R310.1': 'R319.1',
  'R310.2': 'R319.2',
  // Guards / glazing sill height
  'R312.1': 'R318.8',
  'R312.1.3': 'R318.8.3',
  'R312.2.1': 'R319.2.4',
  // Fire / garage (stable across editions)
  'R302.5.1': 'R302.5.1',
  'R302.6': 'R302.6',
  'R302.7': 'R302.7',
  // Admin / plan submittal
  'R106.2': 'R106.2',
  'R106.3.1': 'R106.3.1',
}

export function resolveSectionAlias(section: string): string[] {
  const upper = section.toUpperCase()

  if (EXACT_ALIASES[upper]) {
    // Prefer 2025 CRC target when the checklist cites a renumbered 2023 LARC section.
    return [EXACT_ALIASES[upper], section]
  }

  return [section]
}
