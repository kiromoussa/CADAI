import { CODE_BODIES } from '@/lib/analysis/code-bodies'
import type { CodeRefFamily, NormalizedCodeRef } from '@/lib/correction-lists/types'

const FAMILY_CODE_BODY: Record<CodeRefFamily, string | null> = {
  residential: CODE_BODIES.residential,
  building: CODE_BODIES.building,
  electrical: CODE_BODIES.electrical,
  mechanical: CODE_BODIES.mechanical,
  plumbing: CODE_BODIES.plumbing,
  fire: CODE_BODIES.fire,
  green: CODE_BODIES.green,
  lamc: 'Los Angeles Municipal Code',
  labc: 'Los Angeles Building Code',
  larc: 'Los Angeles Residential Code',
  lapc: 'Los Angeles Plumbing Code',
  government: 'California Government Code',
  ordinance: null,
  other: null,
}

/** Collapse OCR spacing artifacts like "6 6323" → "66323". */
export function collapseSectionDigits(value: string): string {
  return value
    .replace(/(\d)\s+(?=\d)/g, '$1')
    .replace(/\s+/g, '')
}

export function splitCompoundRefs(raw: string): string[] {
  return raw
    .split(/,|\s+&\s+|\s+and\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2)
}

function detectFamily(ref: string): CodeRefFamily {
  const upper = ref.toUpperCase()
  if (upper.startsWith('LAMC')) return 'lamc'
  if (upper.startsWith('LABC')) return 'labc'
  if (upper.startsWith('LARC')) return 'larc'
  if (upper.startsWith('LAPC')) return 'lapc'
  if (upper.includes('GC §') || upper.includes('GC§')) return 'government'
  if (upper.startsWith('ORDINANCE')) return 'ordinance'
  if (/\bR\d{3}/.test(upper)) return 'residential'
  if (/\b(CEC|CEC\s)/i.test(ref)) return 'electrical'
  if (/\bCMC\b/i.test(ref)) return 'mechanical'
  if (/\bCPC\b/i.test(ref)) return 'plumbing'
  if (/\bCFC\b/i.test(ref)) return 'fire'
  if (/\bCALGREEN|GREEN\b/i.test(ref)) return 'green'
  if (/\b\d{3,4}\.\d/.test(ref)) return 'building'
  return 'other'
}

function extractSectionToken(ref: string, family: CodeRefFamily): string {
  const cleaned = ref.trim()

  if (family === 'government') {
    const afterSymbol = cleaned.replace(/^GC\s*§\s*/i, '')
    return collapseSectionDigits(afterSymbol.replace(/[^0-9().a-zA-Z/-]/g, ''))
  }

  if (family === 'lamc' || family === 'labc' || family === 'larc' || family === 'lapc') {
    const m = cleaned.match(
      /(?:LAMC|LABC|LARC|LAPC)\s+([\d.]+[A-Za-z]?[\d()./-]*)/
    )
    return m ? collapseSectionDigits(m[1]) : collapseSectionDigits(cleaned)
  }

  if (family === 'ordinance') {
    const m = cleaned.match(/Ordinance\s+([\d,]+)/i)
    return m ? m[1].replace(/,/g, '') : cleaned
  }

  const rMatch = cleaned.match(/\b(R\d{3}(?:\.\d+)*)/i)
  if (rMatch) return rMatch[1].toUpperCase()

  const sectionMatch = cleaned.match(/\b(\d{3,4}(?:\.\d+)+)/)
  if (sectionMatch) return sectionMatch[1]

  return collapseSectionDigits(cleaned)
}

function isValidCodeRef(raw: string): boolean {
  if (/https?:\/\//i.test(raw)) return false
  if (/PC\/STR\/Corr/i.test(raw)) return false
  if (/\b(four|foot|rear|side|yard|setbacks)\b/i.test(raw) && !/\d{3}/.test(raw)) {
    return false
  }
  return true
}

export function normalizeCodeRef(raw: string): NormalizedCodeRef | null {
  const trimmed = raw.trim().replace(/^\(|\)$/g, '').replace(/\s+/g, ' ')
  if (!isValidCodeRef(trimmed)) return null
  const family = detectFamily(trimmed)
  const section = extractSectionToken(trimmed, family)
  if (section.length < 2) return null
  return {
    raw: trimmed,
    family,
    section,
    code_body: FAMILY_CODE_BODY[family],
  }
}

export function normalizeCodeRefs(refs: string[]): NormalizedCodeRef[] {
  const seen = new Set<string>()
  const out: NormalizedCodeRef[] = []

  for (const raw of refs) {
    for (const part of splitCompoundRefs(raw)) {
      const normalized = normalizeCodeRef(part)
      if (!normalized) continue
      const key = `${normalized.family}:${normalized.section}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(normalized)
    }
  }

  return out
}

export function isLocalOnlyRef(ref: NormalizedCodeRef): boolean {
  return (
    ref.family === 'lamc' ||
    ref.family === 'labc' ||
    ref.family === 'larc' ||
    ref.family === 'lapc' ||
    ref.family === 'government' ||
    ref.family === 'ordinance'
  )
}
