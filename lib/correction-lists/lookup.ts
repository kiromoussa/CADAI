import fs from 'node:fs'
import path from 'node:path'
import { isLocalOnlyRef, normalizeCodeRef } from '@/lib/correction-lists/code-refs'
import { resolveSectionAlias } from '@/lib/correction-lists/section-aliases'
import type { CodeRefLookupResult, NormalizedCodeRef } from '@/lib/correction-lists/types'

const CHUNK_DIR = path.join(process.cwd(), 'lib/raw/chunks')

const FAMILY_CHUNK_FILES: Record<string, string[]> = {
  residential: ['gov.ca.bsc.residential.2025_djvu_chunked.md'],
  building: ['gov.ca.bsc.building.2025_djvu_chunked.md'],
  electrical: ['gov.ca.bsc.electrical.2025_djvu_chunked.md'],
  mechanical: ['gov.ca.bsc.mechanical.2025_djvu_chunked.md'],
  plumbing: ['gov.ca.bsc.plumbing.2025_djvu_chunked.md'],
  fire: ['gov.ca.bsc.fire.2025_djvu_chunked.md'],
  green: ['gov.ca.bsc.green.2025_djvu_chunked.md'],
}

let chunkCache: Map<string, string> | null = null

function loadChunkCache(): Map<string, string> {
  if (chunkCache) return chunkCache
  chunkCache = new Map()
  for (const files of Object.values(FAMILY_CHUNK_FILES)) {
    for (const file of files) {
      const fullPath = path.join(CHUNK_DIR, file)
      if (fs.existsSync(fullPath)) {
        chunkCache.set(file, fs.readFileSync(fullPath, 'utf8'))
      }
    }
  }
  return chunkCache
}

function sectionPatterns(section: string): RegExp[] {
  const escaped = section.replace(/\./g, '\\.')
  const patterns = [new RegExp(`\\b${escaped}\\b`, 'i')]
  if (/^Table\s+/i.test(section)) {
    patterns.push(new RegExp(section.replace(/\s+/g, '\\s*'), 'i'))
  }
  if (/^\d/.test(section)) {
    patterns.push(new RegExp(`\\b${escaped}(?:\\b|[,\\s])`, 'i'))
  }
  return patterns
}

function chunkContainsSection(chunk: string, section: string): boolean {
  return sectionPatterns(section).some((re) => re.test(chunk))
}

function extractTitle(chunk: string, section: string): string | undefined {
  const re = sectionPatterns(section)[0]
  const idx = chunk.search(re)
  if (idx === -1) return undefined
  const slice = chunk.slice(idx, idx + 240)
  const line = slice.split('\n')[0] ?? slice
  const after = line.replace(re, '').trim()
  return after.slice(0, 120) || undefined
}

function lookupSectionInChunks(
  ref: NormalizedCodeRef,
  section: string
): CodeRefLookupResult | null {
  const cache = loadChunkCache()
  const files =
    FAMILY_CHUNK_FILES[ref.family] ??
    [...(FAMILY_CHUNK_FILES.residential ?? []), ...(FAMILY_CHUNK_FILES.building ?? [])]

  for (const file of files) {
    const chunk = cache.get(file)
    if (!chunk) continue
    if (chunkContainsSection(chunk, section)) {
      return {
        ref: { ...ref, section },
        found: true,
        source: 'chunk',
        title: extractTitle(chunk, section),
        chunk_file: file,
      }
    }
  }

  for (const [file, chunk] of Array.from(cache.entries())) {
    if (files.includes(file)) continue
    if (chunkContainsSection(chunk, section)) {
      return {
        ref: { ...ref, section },
        found: true,
        source: 'chunk',
        title: extractTitle(chunk, section),
        chunk_file: file,
      }
    }
  }

  return null
}

export function lookupCodeRef(ref: NormalizedCodeRef): CodeRefLookupResult {
  if (isLocalOnlyRef(ref)) {
    return {
      ref,
      found: true,
      source: 'local_only',
      title: `${ref.code_body ?? ref.family} § ${ref.section}`,
    }
  }

  for (const candidate of resolveSectionAlias(ref.section)) {
    const hit = lookupSectionInChunks(ref, candidate)
    if (hit) {
      return {
        ...hit,
        ref: { ...hit.ref, section: candidate },
      }
    }
  }

  return {
    ref,
    found: false,
    source: 'not_indexed',
  }
}

export function lookupCodeRefs(refs: string[]): CodeRefLookupResult[] {
  const normalized = refs
    .map((raw) => normalizeCodeRef(raw))
    .filter((ref): ref is NonNullable<typeof ref> => ref != null)
  const seen = new Set<string>()
  const results: CodeRefLookupResult[] = []

  for (const ref of normalized) {
    const key = `${ref.family}:${ref.section}`
    if (seen.has(key)) continue
    seen.add(key)
    results.push(lookupCodeRef(ref))
  }

  return results
}
