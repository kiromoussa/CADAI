import { inferDiscipline } from '@/lib/analysis/disciplines'
import type {
  Discipline,
  ExtractedLayer,
  ExtractedProperties,
  ExtractedSheet,
} from '@/types/analysis'

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

type SheetParseContext = {
  sheetGuid?: string
  sheetName?: string
  discipline?: Discipline
}

function withSheetContext<T extends object>(
  item: T,
  ctx?: SheetParseContext
): T & SheetParseContext {
  if (!ctx?.sheetGuid && !ctx?.sheetName && !ctx?.discipline) return item as T & SheetParseContext
  return {
    ...item,
    sheet_guid: ctx.sheetGuid,
    sheet_name: ctx.sheetName,
    discipline: ctx.discipline,
  }
}

function collectLayers(
  collection: Array<{ properties?: Record<string, unknown>; name: string }>
): ExtractedLayer[] {
  const counts = new Map<string, number>()
  for (const item of collection) {
    const layer = layerOrBlockName(item)
    counts.set(layer, (counts.get(layer) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([name, entity_count]) => ({ name, entity_count }))
    .sort((a, b) => b.entity_count - a.entity_count)
    .slice(0, 40)
}

function parseDwgProperties(
  collection: Array<{
    objectid: number
    name: string
    properties?: Record<string, unknown>
  }>,
  ctx?: SheetParseContext
): ExtractedProperties {
  const rooms: ExtractedProperties['rooms'] = []
  const windows: ExtractedProperties['windows'] = []
  const doors: ExtractedProperties['doors'] = []
  const stairs: ExtractedProperties['stairs'] = []

  for (const item of collection) {
    const label = layerOrBlockName(item)
    const haystack = `${label} ${item.name}`.toLowerCase()

    if (
      /\b(door|a-door|a_door|dr-|dr\.|opening)\b/.test(haystack) ||
      /-dr\b|_dr\b/.test(haystack)
    ) {
      doors.push(
        withSheetContext({ name: label, dbId: item.objectid }, ctx)
      )
      continue
    }

    if (
      /\b(window|glaz|w\/d|w_d|a-glaz|a_glaz|a-wind)\b/.test(haystack) ||
      /-win\b|_win\b/.test(haystack)
    ) {
      windows.push(
        withSheetContext({ name: label, dbId: item.objectid }, ctx)
      )
      continue
    }

    if (/\b(stair|a-stair|a_stair|rail|handrail|guard)\b/.test(haystack)) {
      stairs.push(
        withSheetContext({ name: label, dbId: item.objectid }, ctx)
      )
      continue
    }

    if (
      /\b(panel|circuit|outlet|receptacle|switch|lighting|fixture|e-|e_|elect)\b/.test(
        haystack
      )
    ) {
      rooms.push(withSheetContext({ name: label, dbId: item.objectid }, ctx))
      continue
    }

    if (/\b(pipe|duct|sprinkler|vent|drain|sewer|hvac|p-|p_|m-|m_)\b/.test(haystack)) {
      rooms.push(withSheetContext({ name: label, dbId: item.objectid }, ctx))
      continue
    }

    if (/\b(truss|rafter|beam|column|footing|foundation|s-|s_)\b/.test(haystack)) {
      rooms.push(withSheetContext({ name: label, dbId: item.objectid }, ctx))
      continue
    }

    if (
      /\b(room|space|bed|bath|kitchen|living|dining|garage|office|closet|hall|foyer|utility|laundry|a-flor|a_flor|a-area)\b/.test(
        haystack
      )
    ) {
      rooms.push(withSheetContext({ name: label, dbId: item.objectid }, ctx))
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

/** When entity names are generic but layer names carry AIA discipline info. */
function parseDwgLayerInventoryFallback(
  collection: Array<{
    objectid: number
    name: string
    properties?: Record<string, unknown>
  }>,
  ctx?: SheetParseContext
): ExtractedProperties {
  const layers = collectLayers(collection)
  const rooms: ExtractedProperties['rooms'] = []
  const windows: ExtractedProperties['windows'] = []
  const doors: ExtractedProperties['doors'] = []
  const stairs: ExtractedProperties['stairs'] = []

  for (const { name, entity_count } of layers) {
    const haystack = name.toLowerCase()
    const tagged = withSheetContext({ name, entity_count }, ctx)

    if (
      /\b(door|a-door|a_door|dr-|dr\.|opening)\b/.test(haystack) ||
      /-dr\b|_dr\b/.test(haystack)
    ) {
      doors.push(tagged)
      continue
    }
    if (
      /\b(window|glaz|w\/d|w_d|a-glaz|a_glaz|a-wind)\b/.test(haystack) ||
      /-win\b|_win\b/.test(haystack)
    ) {
      windows.push(tagged)
      continue
    }
    if (/\b(stair|a-stair|a_stair|rail|handrail|guard)\b/.test(haystack)) {
      stairs.push(tagged)
      continue
    }
    if (
      /\b(a-|a_|s-|s_|e-|e_|m-|m_|p-|p_|i-|i_|furn|anot|dim|hatch|defpoints)\b/.test(
        haystack
      ) ||
      entity_count >= 3
    ) {
      rooms.push(tagged)
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
  options?: { preferDwg?: boolean; sheet?: SheetParseContext }
): ExtractedProperties {
  if (options?.preferDwg) {
    const dwg = parseDwgProperties(collection, options.sheet)
    if (!isPropertiesEmpty(dwg)) return dwg
    const layerDwg = parseDwgLayerInventoryFallback(collection, options.sheet)
    if (!isPropertiesEmpty(layerDwg)) return layerDwg
  }

  const rooms: ExtractedProperties['rooms'] = []
  const windows: ExtractedProperties['windows'] = []
  const doors: ExtractedProperties['doors'] = []
  const stairs: ExtractedProperties['stairs'] = []

  for (const item of collection) {
    const props = item.properties ?? {}
    const category = categoryName(item).toLowerCase()

    if (category.includes('room') || category.includes('space')) {
      rooms.push(
        withSheetContext(
          {
            name: readString(props, ['Name', 'Room Name', 'Type Name']) ?? item.name,
            area_sqft: readNumber(props, ['Area', 'Room Area', 'Gross Area']),
            length_ft: readNumber(props, ['Length']),
            width_ft: readNumber(props, ['Width']),
            ceiling_height_ft: readNumber(props, [
              'Unbounded Height',
              'Height',
              'Ceiling Height',
            ]),
            level: readString(props, ['Level', 'Base Level']),
          },
          options?.sheet
        )
      )
      continue
    }

    if (category.includes('window')) {
      windows.push(
        withSheetContext(
          {
            name: readString(props, ['Mark', 'Type Name', 'Family and Type']) ?? item.name,
            width_in: readNumber(props, ['Width', 'Rough Width']),
            height_in: readNumber(props, ['Height', 'Rough Height']),
            sill_height_in: readNumber(props, ['Sill Height', 'Default Sill Height']),
            level: readString(props, ['Level', 'Base Level']),
            dbId: item.objectid,
          },
          options?.sheet
        )
      )
      continue
    }

    if (category.includes('door')) {
      doors.push(
        withSheetContext(
          {
            name: readString(props, ['Mark', 'Type Name', 'Family and Type']) ?? item.name,
            width_in: readNumber(props, ['Width', 'Rough Width']),
            height_in: readNumber(props, ['Height', 'Rough Height']),
            level: readString(props, ['Level', 'Base Level']),
            dbId: item.objectid,
          },
          options?.sheet
        )
      )
      continue
    }

    if (category.includes('stair')) {
      stairs.push(
        withSheetContext(
          {
            name: readString(props, ['Type Name', 'Family and Type']) ?? item.name,
            riser_height_in: readNumber(props, ['Riser Height', 'Actual Riser Height']),
            tread_depth_in: readNumber(props, ['Tread Depth', 'Actual Tread Depth']),
            width_in: readNumber(props, ['Width', 'Actual Run Width']),
            level: readString(props, ['Base Level', 'Level']),
            dbId: item.objectid,
          },
          options?.sheet
        )
      )
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
    const dwgFallback = parseDwgProperties(collection, options?.sheet)
    if (!isPropertiesEmpty(dwgFallback)) return dwgFallback
    const layerFallback = parseDwgLayerInventoryFallback(collection, options?.sheet)
    if (!isPropertiesEmpty(layerFallback)) return layerFallback
  }

  return revitResult
}

function mergeSheetResults(sheets: ExtractedSheet[]): ExtractedProperties {
  return {
    rooms: sheets.flatMap((s) => s.rooms),
    windows: sheets.flatMap((s) => s.windows),
    doors: sheets.flatMap((s) => s.doors),
    stairs: sheets.flatMap((s) => s.stairs),
    sheets,
    project: { building_type: 'residential' },
  }
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

type PropertiesCollection = Array<{
  objectid: number
  name: string
  properties?: Record<string, unknown>
}>

type PropertiesResponse = {
  data: { collection: PropertiesCollection }
}

const PROPERTIES_POLL_MS = 90_000
const PROPERTIES_POLL_INITIAL_DELAY_MS = 800
const DWG_INDEX_WAIT_MS = 120_000
/** APS rejects thumbnails above ~1000px for many DWG derivatives. */
const THUMBNAIL_SIZES = [1000, 800, 400] as const

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchThumbnailBuffer(
  baseUrl: string,
  token: string,
  sizes: readonly number[] = THUMBNAIL_SIZES
): Promise<Buffer> {
  let lastError: Error | null = null
  for (const size of sizes) {
    const response = await fetch(`${baseUrl}?width=${size}&height=${size}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (response.status === 400 && size !== sizes[sizes.length - 1]) {
      continue
    }
    if (!response.ok) {
      lastError = new Error(`APS thumbnail failed (${response.status})`)
      continue
    }
    const buf = Buffer.from(await response.arrayBuffer())
    if (buf.length === 0) {
      lastError = new Error('APS thumbnail returned empty body')
      continue
    }
    return buf
  }
  throw lastError ?? new Error('APS thumbnail failed')
}

type MetadataView = { guid: string; name?: string; role?: string }

/** Prefer named sheets (e.g. SP-1) over the aggregate "2D Views" parent. */
function orderTwoDViews(views: MetadataView[]): MetadataView[] {
  const sheets = views.filter((v) => v.role === '2d')
  const named = sheets.filter((v) => v.name && v.name !== '2D Views')
  if (named.length === 0) return sheets
  const aggregate = sheets.filter((v) => v.name === '2D Views')
  return [...named, ...aggregate]
}

/** Block until APS property DB has data (202/empty 200 while indexing). */
async function waitForDwgPropertyIndex(
  urn: string,
  guid: string,
  token: string,
  options?: { maxWaitMs?: number; onWaiting?: () => void }
): Promise<void> {
  const maxWaitMs = options?.maxWaitMs ?? DWG_INDEX_WAIT_MS
  const started = Date.now()
  let delayMs = PROPERTIES_POLL_INITIAL_DELAY_MS

  while (Date.now() - started < maxWaitMs) {
    const response = await fetch(
      `${MD_BASE}/${encodeURIComponent(urn)}/metadata/${guid}/properties?forceget=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (response.status === 202) {
      options?.onWaiting?.()
      await sleep(delayMs)
      delayMs = Math.min(Math.round(delayMs * 1.4), 5000)
      continue
    }

    if (response.status === 204) {
      return
    }

    if (!response.ok) {
      return
    }

    const text = await response.text()
    if (!text.trim()) {
      options?.onWaiting?.()
      await sleep(delayMs)
      delayMs = Math.min(Math.round(delayMs * 1.4), 5000)
      continue
    }

    try {
      const parsed = JSON.parse(text) as {
        data?: { collection?: PropertiesCollection }
      }
      const count = parsed.data?.collection?.length ?? 0
      if (count > 0) return
    } catch {
      return
    }

    options?.onWaiting?.()
    await sleep(delayMs)
    delayMs = Math.min(Math.round(delayMs * 1.4), 5000)
  }

  console.warn(
    `[aps] DWG property index wait timed out for ${guid.slice(0, 8)}… after ${maxWaitMs}ms`
  )
}

/** APS returns 202 while the property DB is still indexing — poll until ready or timeout. */
export async function getProperties(
  urn: string,
  guid: string,
  token: string,
  options?: { maxWaitMs?: number }
): Promise<PropertiesResponse> {
  const maxWaitMs = options?.maxWaitMs ?? PROPERTIES_POLL_MS
  const started = Date.now()
  let delayMs = PROPERTIES_POLL_INITIAL_DELAY_MS

  while (true) {
    const response = await fetch(
      `${MD_BASE}/${encodeURIComponent(urn)}/metadata/${guid}/properties?forceget=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (response.status === 204) {
      return { data: { collection: [] } }
    }

    if (response.status === 202) {
      if (Date.now() - started >= maxWaitMs) {
        console.warn(
          `[aps] Properties still indexing for ${guid.slice(0, 8)}… after ${maxWaitMs}ms`
        )
        return { data: { collection: [] } }
      }
      await sleep(delayMs)
      delayMs = Math.min(Math.round(delayMs * 1.4), 5000)
      continue
    }

    if (!response.ok) {
      throw new Error(`APS properties failed (${response.status})`)
    }

    const text = await response.text()
    if (!text.trim()) {
      return { data: { collection: [] } }
    }
    try {
      const parsed = JSON.parse(text) as {
        data?: { collection?: PropertiesCollection }
      }
      return { data: { collection: parsed.data?.collection ?? [] } }
    } catch {
      return { data: { collection: [] } }
    }
  }
}

/** Raster preview of a specific 2D sheet/view. */
export async function fetchViewThumbnailPng(
  urn: string,
  guid: string,
  token: string,
  options?: { width?: number; height?: number }
): Promise<Buffer> {
  const size = options?.width ?? options?.height ?? THUMBNAIL_SIZES[0]
  const sizes = THUMBNAIL_SIZES.includes(size as (typeof THUMBNAIL_SIZES)[number])
    ? ([size, ...THUMBNAIL_SIZES.filter((s) => s !== size)] as readonly number[])
    : THUMBNAIL_SIZES
  return fetchThumbnailBuffer(
    `${MD_BASE}/${encodeURIComponent(urn)}/metadata/${encodeURIComponent(guid)}/thumbnail`,
    token,
    sizes
  )
}

/** Raster preview of a translated model (DWG 2D sheets have no property API). */
export async function fetchModelThumbnailPng(
  urn: string,
  token: string,
  options?: { width?: number; height?: number }
): Promise<Buffer> {
  const size = options?.width ?? options?.height ?? THUMBNAIL_SIZES[0]
  const sizes = THUMBNAIL_SIZES.includes(size as (typeof THUMBNAIL_SIZES)[number])
    ? ([size, ...THUMBNAIL_SIZES.filter((s) => s !== size)] as readonly number[])
    : THUMBNAIL_SIZES
  return fetchThumbnailBuffer(
    `${MD_BASE}/${encodeURIComponent(urn)}/thumbnail`,
    token,
    sizes
  )
}

export type ExtractProgressCallback = (
  current: number,
  total: number,
  sheetName: string,
  discipline: Discipline
) => void

export async function listSheetViews(
  urn: string,
  token: string
): Promise<Array<{ guid: string; name: string; role: string; discipline: Discipline }>> {
  const metadata = await getMetadata(urn, token)
  const views = metadata.data.metadata.filter((v) => v.role === '2d')
  return views.map((view) => ({
    guid: view.guid,
    name: view.name || 'Untitled sheet',
    role: view.role,
    discipline: inferDiscipline(view.name),
  }))
}

export async function extractPropertiesFromUrn(
  urn: string,
  token: string,
  options?: {
    fileExtension?: string
    onProgress?: ExtractProgressCallback
    onWaiting?: (message: string) => void
    extractionContext?: { city: string; state: string; project_type: string }
  }
): Promise<ExtractedProperties> {
  const metadata = await getMetadata(urn, token)
  const views = metadata.data.metadata
  const twoDViews = orderTwoDViews(views)
  const preferDwg = options?.fileExtension
    ? isDwgExtension(options.fileExtension)
    : false

  if (preferDwg && twoDViews.length > 0) {
    const waitMessage = 'Waiting for Autodesk to index DWG properties…'
    options?.onWaiting?.(waitMessage)
    for (const view of twoDViews) {
      await waitForDwgPropertyIndex(urn, view.guid, token, {
        onWaiting: () => options?.onWaiting?.(waitMessage),
      })
    }
  }

  if (twoDViews.length === 0) {
    const preferred = pickPreferredMetadataView(views)
    if (!preferred) {
      throw new Error('No viewable metadata found for model')
    }
    const raw = await getProperties(urn, preferred.guid, token)
    const parsed = parseProperties(raw.data.collection, { preferDwg })
    if (!isPropertiesEmpty(parsed)) {
      return parsed
    }
    if (preferDwg && options?.extractionContext) {
      return tryDwgFallbackExtraction(
        urn,
        token,
        options.extractionContext,
        twoDViews.map((v) => ({ guid: v.guid, name: v.name || 'Untitled sheet' }))
      )
    }
    return parsed
  }

  const sheets: ExtractedSheet[] = []
  const ctx = options?.extractionContext

  for (let i = 0; i < twoDViews.length; i++) {
    const view = twoDViews[i]
    const sheetName = view.name || `Sheet ${i + 1}`

    let collection: Array<{
      objectid: number
      name: string
      properties?: Record<string, unknown>
    }> = []

    try {
      const raw = await getProperties(urn, view.guid, token)
      collection = raw.data.collection ?? []
    } catch {
      collection = []
    }

    const layerNames = collectLayers(collection).map((l) => l.name)
    const discipline = inferDiscipline(sheetName, layerNames)
    options?.onProgress?.(i + 1, twoDViews.length, sheetName, discipline)

    let parsed = parseProperties(collection, {
      preferDwg,
      sheet: { sheetGuid: view.guid, sheetName, discipline },
    })

    if (isPropertiesEmpty(parsed) && preferDwg && ctx) {
      const vision = await extractSheetViaVision(
        urn,
        { guid: view.guid, name: sheetName, discipline },
        token,
        ctx
      )
      if (vision) parsed = vision
    }

    sheets.push({
      guid: view.guid,
      name: sheetName,
      discipline,
      layers: collectLayers(collection),
      rooms: parsed.rooms,
      windows: parsed.windows,
      doors: parsed.doors,
      stairs: parsed.stairs,
    })
  }

  const merged = mergeSheetResults(sheets)
  if (!isPropertiesEmpty(merged)) {
    return merged
  }

  if (preferDwg && options?.extractionContext) {
    return tryDwgFallbackExtraction(
      urn,
      token,
      options.extractionContext,
      twoDViews.map((v) => ({ guid: v.guid, name: v.name || 'Untitled sheet' }))
    )
  }

  const preferred = pickPreferredMetadataView(views)
  if (!preferred) {
    throw new Error('No extractable entities found across any sheet')
  }

  const raw = await getProperties(urn, preferred.guid, token)
  const parsed = parseProperties(raw.data.collection, { preferDwg })
  if (!isPropertiesEmpty(parsed)) {
    return parsed
  }

  throw new Error('No extractable entities found across any sheet')
}

type ManifestMessage = { type?: string; message?: string | string[]; code?: string }

type ManifestNode = {
  status?: string
  progress?: string
  messages?: ManifestMessage[]
  derivatives?: ManifestNode[]
  children?: ManifestNode[]
  outputType?: string
  type?: string
  role?: string
  mime?: string
  urn?: string
}

export async function getManifest(
  urn: string,
  token: string
): Promise<ManifestNode | null> {
  const response = await fetch(`${MD_BASE}/${encodeURIComponent(urn)}/manifest`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`APS manifest failed (${response.status})`)
  }
  return (await response.json()) as ManifestNode
}

export function collectPdfDerivativeUrns(manifest: ManifestNode): string[] {
  const urns: string[] = []
  walkManifest(manifest, (node) => {
    if (node.status === 'success' && node.mime === 'application/pdf' && node.urn) {
      urns.push(node.urn)
    }
  })
  return urns
}

async function fetchManifestDerivative(
  sourceUrn: string,
  derivativeUrn: string,
  token: string
): Promise<Buffer> {
  const response = await fetch(
    `${MD_BASE}/${encodeURIComponent(sourceUrn)}/manifest/${encodeURIComponent(derivativeUrn)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!response.ok) {
    throw new Error(`APS derivative download failed (${response.status})`)
  }
  const buf = Buffer.from(await response.arrayBuffer())
  if (buf.length === 0) {
    throw new Error('APS derivative returned empty body')
  }
  return buf
}

function tagPropertiesWithSheet(
  properties: ExtractedProperties,
  sheet: { guid: string; name: string; discipline: Discipline }
): ExtractedProperties {
  const ctx = {
    sheetGuid: sheet.guid,
    sheetName: sheet.name,
    discipline: sheet.discipline,
  }
  const tag = <T extends object>(item: T) => withSheetContext(item, ctx)
  return {
    ...properties,
    rooms: properties.rooms.map(tag),
    windows: properties.windows.map(tag),
    doors: properties.doors.map(tag),
    stairs: properties.stairs.map(tag),
    garage: properties.garage ? tag(properties.garage) : undefined,
  }
}

async function extractSheetViaVision(
  urn: string,
  view: { guid: string; name: string; discipline: Discipline },
  token: string,
  context: { city: string; state: string; project_type: string }
): Promise<ExtractedProperties | null> {
  try {
    const png = await fetchViewThumbnailPng(urn, view.guid, token)
    const { extractPropertiesFromPlanImage } = await import('@/lib/analysis/extract-pdf')
    const parsed = await extractPropertiesFromPlanImage(png.toString('base64'), context)
    if (isPropertiesEmpty(parsed)) return null
    return tagPropertiesWithSheet(parsed, view)
  } catch (err) {
    console.warn(
      `[aps] Sheet vision extraction failed for ${view.name}:`,
      err instanceof Error ? err.message : err
    )
    return null
  }
}

function mergeExtractedProperties(
  parts: ExtractedProperties[]
): ExtractedProperties {
  return {
    rooms: parts.flatMap((p) => p.rooms),
    windows: parts.flatMap((p) => p.windows),
    doors: parts.flatMap((p) => p.doors),
    stairs: parts.flatMap((p) => p.stairs),
    garage: parts.find((p) => p.garage)?.garage,
    project: parts.find((p) => p.project)?.project ?? { building_type: 'residential' },
    sheets: parts.flatMap((p) => p.sheets ?? []),
  }
}

function attachSheetsToMerged(
  merged: ExtractedProperties,
  twoDViews: Array<{ guid: string; name: string }>
): ExtractedProperties {
  if (merged.sheets?.length) return merged
  if (twoDViews.length === 0) return merged

  const hasSheetTags = [...merged.rooms, ...merged.windows, ...merged.doors, ...merged.stairs].some(
    (e) => e.sheet_guid
  )
  if (!hasSheetTags) {
    const primary = twoDViews[0]
    return {
      ...merged,
      sheets: [
        {
          guid: primary.guid,
          name: primary.name || 'Sheet 1',
          discipline: inferDiscipline(primary.name),
          layers: [],
          rooms: merged.rooms,
          windows: merged.windows,
          doors: merged.doors,
          stairs: merged.stairs,
        },
      ],
    }
  }

  return {
    ...merged,
    sheets: twoDViews.map((view, idx) => ({
      guid: view.guid,
      name: view.name || `Sheet ${idx + 1}`,
      discipline: inferDiscipline(view.name),
      layers: [],
      rooms: merged.rooms.filter((r) => r.sheet_guid === view.guid),
      windows: merged.windows.filter((w) => w.sheet_guid === view.guid),
      doors: merged.doors.filter((d) => d.sheet_guid === view.guid),
      stairs: merged.stairs.filter((s) => s.sheet_guid === view.guid),
    })),
  }
}

/** DWG 2D sheets often lack APS property DB — prefer thumbnails, then document-only PDF. */
async function tryDwgFallbackExtraction(
  urn: string,
  token: string,
  context: { city: string; state: string; project_type: string },
  twoDViews: Array<{ guid: string; name: string }> = []
): Promise<ExtractedProperties> {
  // 1. Per-sheet APS thumbnails + vision (no pdf.js / canvas — most reliable for DWG)
  if (twoDViews.length > 0) {
    const parts: ExtractedProperties[] = []
    for (const view of twoDViews) {
      const vision = await extractSheetViaVision(
        urn,
        { ...view, discipline: inferDiscipline(view.name) },
        token,
        context
      )
      if (vision) parts.push(vision)
    }
    const merged = mergeExtractedProperties(parts)
    if (!isPropertiesEmpty(merged)) {
      return attachSheetsToMerged(merged, twoDViews)
    }
  }

  // 2. Translated PDF derivatives — document API only (APS PDFs crash native render)
  const manifest = await getManifest(urn, token)
  const pdfUrns = manifest ? collectPdfDerivativeUrns(manifest) : []

  if (pdfUrns.length > 0) {
    const { extractPropertiesFromPdfDocumentOnly } = await import('@/lib/analysis/extract-pdf')
    const parts: ExtractedProperties[] = []
    for (let i = 0; i < pdfUrns.length; i++) {
      try {
        const derivUrn = pdfUrns[i]
        const pdf = await fetchManifestDerivative(urn, derivUrn, token)
        const parsed = await extractPropertiesFromPdfDocumentOnly(
          pdf.toString('base64'),
          context
        )
        const view = twoDViews[i]
        if (view) {
          parts.push(
            tagPropertiesWithSheet(parsed, {
              guid: view.guid,
              name: view.name || `Sheet ${i + 1}`,
              discipline: inferDiscipline(view.name),
            })
          )
        } else {
          parts.push(parsed)
        }
      } catch (err) {
        console.warn('[dwg-fallback] PDF document extraction failed:', err)
      }
    }
    const merged = mergeExtractedProperties(parts)
    if (!isPropertiesEmpty(merged)) {
      return attachSheetsToMerged(merged, twoDViews)
    }
  }

  // 3. Whole-model thumbnail + vision (per-sheet thumbnails often 404 on DWG)
  try {
    const { extractPropertiesFromPlanImage } = await import('@/lib/analysis/extract-pdf')
    const png = await fetchModelThumbnailPng(urn, token)
    const parsed = await extractPropertiesFromPlanImage(png.toString('base64'), context)
    if (!isPropertiesEmpty(parsed)) {
      return attachSheetsToMerged(parsed, twoDViews)
    }
  } catch (err) {
    console.warn('[dwg-fallback] Model thumbnail extraction failed:', err)
  }

  return attachSheetsToMerged(
    {
      rooms: [],
      windows: [],
      doors: [],
      stairs: [],
    },
    twoDViews
  )
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
  for (const child of manifestChildNodes(node)) {
    errors.push(...collectManifestErrors(child))
  }
  return errors
}

function manifestChildNodes(node: ManifestNode): ManifestNode[] {
  return [...(node.derivatives ?? []), ...(node.children ?? [])]
}

function walkManifest(node: ManifestNode, visit: (node: ManifestNode) => void): void {
  visit(node)
  for (const child of manifestChildNodes(node)) {
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

/** True when at least one 2D sheet geometry finished (DWG can stay at 99% while 3D lags). */
export function hasSuccessful2dGeometry(manifest: ManifestNode): boolean {
  let ready = false
  walkManifest(manifest, (node) => {
    if (node.type === 'geometry' && node.role === '2d' && node.status === 'success') {
      ready = true
    }
  })
  return ready
}

export function parseProgressPercent(progress: string | undefined): number | null {
  if (!progress) return null
  const match = progress.match(/(\d+)\s*%/)
  return match ? parseInt(match[1], 10) : null
}

function stallBaselineStartedAt(options?: CheckTranslationOptions): string | null | undefined {
  if (options?.forceRetried && options.forceRetriedAt) {
    return options.forceRetriedAt
  }
  return options?.translationStartedAt
}

function isTranslationStalled(
  manifest: ManifestNode,
  options?: CheckTranslationOptions
): boolean {
  if (manifest.status === 'success') return false
  const progress = manifest.progress ?? ''
  const percent = parseProgressPercent(progress)
  const highProgress =
    (percent !== null && percent >= STALL_PROGRESS_THRESHOLD) || progress.includes('99%')
  if (!highProgress) return false
  const startedAt = stallBaselineStartedAt(options)
  if (!startedAt) return false
  const elapsed = Date.now() - new Date(startedAt).getTime()
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
  const manifest = await getManifest(urn, token)
  if (!manifest) return { status: 'pending' }
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

  const has2d = await metadataHas2dView(urn, token)
  const has2dSheets = hasSuccessful2dGeometry(manifest)
  const hasGeometry = childStatus.hasViewableGeometry || hasViewableDerivative(manifest)
  const stalled = isTranslationStalled(manifest, options)

  // 2D geometry can finish while the manifest is still at 99% and before APS builds
  // the property DB used for DWG compliance extraction — wait for full success.
  if (has2d && has2dSheets) {
    if (manifest.status === 'success') {
      return { status: 'complete', progress: progress ?? 'complete' }
    }
    return {
      status: 'processing',
      progress: progress ?? 'Finalizing sheet data…',
      stalled,
    }
  }

  if (manifest.status === 'success') {
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
  // Do not set advanced.2dviews to "pdf" for DWG — that replaces SVF2 sheet
  // geometry with PDF derivatives (good for download/extraction, breaks the viewer).

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
