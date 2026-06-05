import type { ExtractedProperties } from '@/types/analysis'

const MD_BASE = 'https://developer.api.autodesk.com/modelderivative/v2/designdata'

const VIEWABLE_GEOMETRY_TYPES = new Set(['svf', 'svf2'])
const STALL_PROGRESS_THRESHOLD = 95
const STALL_AFTER_MS = 3 * 60 * 1000
const STALL_FAIL_AFTER_RETRY_MS = 5 * 60 * 1000

function readNumber(props: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = props[key]
    if (typeof value === 'number' && !Number.isNaN(value)) return value
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[^\d.-]/g, ''))
      if (!Number.isNaN(parsed)) return parsed
    }
  }
  return undefined
}

function readString(props: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = props[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function categoryName(entry: { name?: string; properties?: Record<string, unknown> }): string {
  const category = entry.properties?.Category
  if (typeof category === 'string') return category
  return entry.name ?? ''
}

function layerOrBlockName(
  item: { name: string; properties?: Record<string, unknown> }
): string {
  return (
    readString(item.properties ?? {}, ['Layer', 'layer', 'Name', 'Block Name']) ??
    item.name
  )
}

export function fileExtensionFromName(fileName: string): string {
  const match = fileName.match(/\.([^.]+)$/)
  return match ? `.${match[1].toLowerCase()}` : ''
}

export function isDwgExtension(fileExtension: string): boolean {
  const ext = fileExtension.toLowerCase().replace(/^\./, '')
  return ext === 'dwg' || ext === 'dxf'
}

function parseDwgProperties(
  collection: Array<{
    objectid: number
    name: string
    properties?: Record<string, unknown>
  }>
): ExtractedProperties {
  const rooms: ExtractedProperties['rooms'] = []
  const windows: ExtractedProperties['windows'] = []
  const doors: ExtractedProperties['doors'] = []
  const stairs: ExtractedProperties['stairs'] = []

  for (const item of collection) {
    const label = layerOrBlockName(item)
    const haystack = `${label} ${item.name}`.toLowerCase()

    if (/door/.test(haystack)) {
      doors.push({
        name: label,
        dbId: item.objectid,
      })
      continue
    }

    if (/window|glaz|w\/d|w_d/.test(haystack)) {
      windows.push({
        name: label,
        dbId: item.objectid,
      })
      continue
    }

    if (/stair|rail/.test(haystack)) {
      stairs.push({
        name: label,
        dbId: item.objectid,
      })
      continue
    }

    if (
      /room|space|bed|bath|kitchen|living|dining|garage|office|closet|hall|foyer|utility|laundry/.test(
        haystack
      )
    ) {
      rooms.push({ name: label })
    }
  }

  return {
    rooms,
    windows,
    doors,
    stairs,
    project: { building_type: 'residential' },
  }
}

export function isPropertiesEmpty(properties: ExtractedProperties): boolean {
  return (
    properties.rooms.length +
      properties.windows.length +
      properties.doors.length +
      properties.stairs.length ===
    0
  )
}

export function parseProperties(
  collection: Array<{
    objectid: number
    name: string
    properties?: Record<string, unknown>
  }>,
  options?: { preferDwg?: boolean }
): ExtractedProperties {
  if (options?.preferDwg) {
    const dwg = parseDwgProperties(collection)
    if (!isPropertiesEmpty(dwg)) return dwg
  }

  const rooms: ExtractedProperties['rooms'] = []
  const windows: ExtractedProperties['windows'] = []
  const doors: ExtractedProperties['doors'] = []
  const stairs: ExtractedProperties['stairs'] = []

  for (const item of collection) {
    const props = item.properties ?? {}
    const category = categoryName(item).toLowerCase()

    if (category.includes('room') || category.includes('space')) {
      rooms.push({
        name: readString(props, ['Name', 'Room Name', 'Type Name']) ?? item.name,
        area_sqft: readNumber(props, ['Area', 'Room Area', 'Gross Area']),
        length_ft: readNumber(props, ['Length']),
        width_ft: readNumber(props, ['Width']),
        ceiling_height_ft: readNumber(props, ['Unbounded Height', 'Height', 'Ceiling Height']),
        level: readString(props, ['Level', 'Base Level']),
      })
      continue
    }

    if (category.includes('window')) {
      windows.push({
        name: readString(props, ['Mark', 'Type Name', 'Family and Type']) ?? item.name,
        width_in: readNumber(props, ['Width', 'Rough Width']),
        height_in: readNumber(props, ['Height', 'Rough Height']),
        sill_height_in: readNumber(props, ['Sill Height', 'Default Sill Height']),
        level: readString(props, ['Level', 'Base Level']),
        dbId: item.objectid,
      })
      continue
    }

    if (category.includes('door')) {
      doors.push({
        name: readString(props, ['Mark', 'Type Name', 'Family and Type']) ?? item.name,
        width_in: readNumber(props, ['Width', 'Rough Width']),
        height_in: readNumber(props, ['Height', 'Rough Height']),
        level: readString(props, ['Level', 'Base Level']),
        dbId: item.objectid,
      })
      continue
    }

    if (category.includes('stair')) {
      stairs.push({
        name: readString(props, ['Type Name', 'Family and Type']) ?? item.name,
        riser_height_in: readNumber(props, ['Riser Height', 'Actual Riser Height']),
        tread_depth_in: readNumber(props, ['Tread Depth', 'Actual Tread Depth']),
        width_in: readNumber(props, ['Width', 'Actual Run Width']),
        level: readString(props, ['Base Level', 'Level']),
        dbId: item.objectid,
      })
    }
  }

  const revitResult: ExtractedProperties = {
    rooms,
    windows,
    doors,
    stairs,
    project: {
      building_type: 'residential',
    },
  }

  if (isPropertiesEmpty(revitResult)) {
    const dwgFallback = parseDwgProperties(collection)
    if (!isPropertiesEmpty(dwgFallback)) return dwgFallback
  }

  return revitResult
}

function pickPreferredMetadataView(
  views: Array<{ guid: string; role: string; name: string }>
) {
  return (
    views.find((v) => v.role === '2d') ??
    views.find((v) => {
      const name = v.name.toLowerCase()
      return name.includes('2d') || name.includes('sheet') || name.includes('plan')
    }) ??
    views[0]
  )
}

async function metadataHas2dView(urn: string, token: string): Promise<boolean> {
  try {
    const metadata = await getMetadata(urn, token)
    return metadata.data.metadata.some((v) => v.role === '2d')
  } catch {
    return false
  }
}

export async function getMetadata(urn: string, token: string) {
  const response = await fetch(`${MD_BASE}/${encodeURIComponent(urn)}/metadata`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    throw new Error(`APS metadata failed (${response.status})`)
  }
  return response.json() as Promise<{
    data: { metadata: Array<{ guid: string; role: string; name: string }> }
  }>
}

export async function getProperties(urn: string, guid: string, token: string) {
  const response = await fetch(
    `${MD_BASE}/${encodeURIComponent(urn)}/metadata/${guid}/properties?forceget=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!response.ok) {
    throw new Error(`APS properties failed (${response.status})`)
  }
  return response.json() as Promise<{
    data: {
      collection: Array<{
        objectid: number
        name: string
        properties?: Record<string, unknown>
      }>
    }
  }>
}

export async function extractPropertiesFromUrn(
  urn: string,
  token: string,
  options?: { fileExtension?: string }
): Promise<ExtractedProperties> {
  const metadata = await getMetadata(urn, token)
  const views = metadata.data.metadata
  const preferred = pickPreferredMetadataView(views)

  if (!preferred) {
    throw new Error('No viewable metadata found for model')
  }

  const raw = await getProperties(urn, preferred.guid, token)
  return parseProperties(raw.data.collection, {
    preferDwg: options?.fileExtension ? isDwgExtension(options.fileExtension) : false,
  })
}

type ManifestMessage = { type?: string; message?: string | string[]; code?: string }

type ManifestNode = {
  status?: string
  progress?: string
  messages?: ManifestMessage[]
  derivatives?: ManifestNode[]
  outputType?: string
}

export type TranslationCheckResult = {
  status: 'pending' | 'processing' | 'complete' | 'failed'
  progress?: string
  detail?: string
  child_errors?: string[]
  stalled?: boolean
}

/** @deprecated Use TranslationCheckResult.status — kept for simple string consumers */
export type TranslationStatusResult = TranslationCheckResult['status'] | string

function collectManifestErrors(node: ManifestNode | undefined): string[] {
  if (!node) return []
  const errors: string[] = []
  for (const msg of node.messages ?? []) {
    if (msg.type !== 'error') continue
    const text = Array.isArray(msg.message) ? msg.message[0] : msg.message
    if (text) errors.push(msg.code ? `${text} (${msg.code})` : text)
  }
  for (const child of node.derivatives ?? []) {
    errors.push(...collectManifestErrors(child))
  }
  return errors
}

function walkManifest(node: ManifestNode, visit: (node: ManifestNode) => void): void {
  visit(node)
  for (const child of node.derivatives ?? []) {
    walkManifest(child, visit)
  }
}

export function collectManifestChildStatus(manifest: ManifestNode): {
  failed: string[]
  hasViewableGeometry: boolean
} {
  const failed: string[] = []
  let hasViewableGeometry = false

  walkManifest(manifest, (node) => {
    const status = node.status?.toLowerCase()
    if (status === 'failed' || status === 'timeout') {
      failed.push(...collectManifestErrors(node))
    }
    const outputType = node.outputType?.toLowerCase()
    if (status === 'success' && outputType && VIEWABLE_GEOMETRY_TYPES.has(outputType)) {
      hasViewableGeometry = true
    }
  })

  return { failed, hasViewableGeometry }
}

export function hasViewableDerivative(manifest: ManifestNode): boolean {
  return collectManifestChildStatus(manifest).hasViewableGeometry
}

export function parseProgressPercent(progress: string | undefined): number | null {
  if (!progress) return null
  const match = progress.match(/(\d+)\s*%/)
  return match ? parseInt(match[1], 10) : null
}

function isTranslationStalled(
  manifest: ManifestNode,
  translationStartedAt?: string | null
): boolean {
  if (manifest.status === 'success') return false
  const progress = manifest.progress ?? ''
  const percent = parseProgressPercent(progress)
  const highProgress =
    (percent !== null && percent >= STALL_PROGRESS_THRESHOLD) || progress.includes('99%')
  if (!highProgress) return false
  if (!translationStartedAt) return false
  const elapsed = Date.now() - new Date(translationStartedAt).getTime()
  return elapsed >= STALL_AFTER_MS
}

export type CheckTranslationOptions = {
  translationStartedAt?: string | null
  forceRetried?: boolean
  forceRetriedAt?: string | null
}

export async function checkTranslationStatus(
  urn: string,
  token: string,
  options?: CheckTranslationOptions
): Promise<TranslationCheckResult> {
  const response = await fetch(
    `${MD_BASE}/${encodeURIComponent(urn)}/manifest`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (response.status === 404) return { status: 'pending' }
  if (!response.ok) {
    throw new Error(`APS manifest failed (${response.status})`)
  }
  const manifest = (await response.json()) as ManifestNode
  const progress = manifest.progress
  const childStatus = collectManifestChildStatus(manifest)

  if (childStatus.failed.length > 0) {
    return {
      status: 'failed',
      progress,
      detail: childStatus.failed[0],
      child_errors: childStatus.failed,
    }
  }

  if (manifest.status === 'success') {
    const has2d = await metadataHas2dView(urn, token)
    const hasGeometry = childStatus.hasViewableGeometry || hasViewableDerivative(manifest)
    if (has2d && hasGeometry) {
      return { status: 'complete', progress }
    }
    return {
      status: 'processing',
      progress: progress ?? 'Finalizing viewable sheets…',
    }
  }

  if (manifest.status === 'failed') {
    const detail = collectManifestErrors(manifest)[0]
    return {
      status: 'failed',
      progress,
      detail: detail ?? 'Model translation failed',
      child_errors: collectManifestErrors(manifest),
    }
  }

  const stalled = isTranslationStalled(manifest, options?.translationStartedAt)

  if (
    stalled &&
    options?.forceRetried &&
    options.forceRetriedAt &&
    Date.now() - new Date(options.forceRetriedAt).getTime() >= STALL_FAIL_AFTER_RETRY_MS
  ) {
    return {
      status: 'failed',
      progress,
      detail:
        'Translation stalled at 99% — DWG layout could not be converted. Try exporting a PDF from AutoCAD and uploading that instead.',
      stalled: true,
    }
  }

  return {
    status: manifest.status ? 'processing' : 'pending',
    progress: progress ?? 'processing',
    stalled,
  }
}

export type TranslationEnsureResult = 'complete' | 'processing' | 'submitted'

/**
 * Submit a Model Derivative job only when needed. Skips re-translation when a
 * successful derivative already exists (unless force is set).
 */
export async function ensureModelTranslated(
  urn: string,
  token: string,
  options?: { force?: boolean; fileExtension?: string }
): Promise<TranslationEnsureResult> {
  const result = await checkTranslationStatus(urn, token)

  if (result.status === 'complete') {
    return 'complete'
  }

  if (result.status === 'processing' && !options?.force) {
    return 'processing'
  }

  await translateModel(urn, token, options)
  return 'submitted'
}

export async function translateModel(
  urn: string,
  token: string,
  options?: { force?: boolean; fileExtension?: string }
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
  if (options?.force) {
    headers['x-ads-force'] = 'true'
  }

  const format: Record<string, unknown> = {
    type: 'svf2',
    views: ['2d'],
  }
  if (options?.fileExtension && isDwgExtension(options.fileExtension)) {
    format.advanced = { '2dviews': 'pdf' }
  }

  const response = await fetch(
    'https://developer.api.autodesk.com/modelderivative/v2/designdata/job',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        input: { urn },
        output: {
          formats: [format],
        },
      }),
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`APS translation job failed (${response.status}): ${text}`)
  }

  return response.json()
}

export function encodeUrn(rawUrn: string): string {
  return Buffer.from(rawUrn).toString('base64url')
}
