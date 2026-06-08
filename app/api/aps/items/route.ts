import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getValidToken } from '@/lib/aps/auth'
import {
  encodeUrn,
  ensureModelTranslated,
  fileExtensionFromName,
} from '@/lib/aps/modelDerivative'

export const dynamic = 'force-dynamic'

interface FolderItem {
  id: string
  type: string
  attributes: {
    displayName: string
    extension?: { type: string; data?: { projectId?: string } }
  }
  relationships?: {
    tip?: { data?: { id: string; type: string } }
    storage?: { data?: { id: string } }
  }
}

function isModelFile(name: string): boolean {
  const lower = name.toLowerCase()
  return (
    lower.endsWith('.rvt') ||
    lower.endsWith('.dwg') ||
    lower.endsWith('.ifc') ||
    lower.endsWith('.nwd') ||
    lower.endsWith('.nwc')
  )
}

async function listFolderItems(
  projectId: string,
  folderId: string,
  token: string,
  acc: Array<{
    item_id: string
    version_id: string
    name: string
    urn: string
  }> = []
) {
  const url = `https://developer.api.autodesk.com/data/v1/projects/${projectId}/folders/${folderId}/contents`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) return acc

  const data = (await response.json()) as { data: FolderItem[] }

  for (const item of data.data ?? []) {
    if (item.type === 'folders') {
      await listFolderItems(projectId, item.id, token, acc)
      continue
    }

    if (item.type !== 'items') continue

    const name = item.attributes.displayName
    if (!isModelFile(name)) continue

    const versionId = item.relationships?.tip?.data?.id
    if (!versionId) continue

    const versionResponse = await fetch(
      `https://developer.api.autodesk.com/data/v1/projects/${projectId}/versions/${encodeURIComponent(versionId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!versionResponse.ok) continue

    const versionData = (await versionResponse.json()) as {
      data: { relationships?: { storage?: { data?: { id: string } } } }
    }
    const storageId = versionData.data.relationships?.storage?.data?.id
    if (!storageId) continue

    const urn = encodeUrn(storageId)
    acc.push({ item_id: item.id, version_id: versionId, name, urn })
  }

  return acc
}

export async function GET(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const hubId = searchParams.get('hub_id')
  const projectId = searchParams.get('project_id')

  if (!hubId || !projectId) {
    return NextResponse.json({ error: 'hub_id and project_id required' }, { status: 400 })
  }

  try {
    const token = await getValidToken(user.id)

    const topFoldersResponse = await fetch(
      `https://developer.api.autodesk.com/project/v1/hubs/${hubId}/projects/${projectId}/topFolders`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!topFoldersResponse.ok) {
      throw new Error(`Failed to list folders (${topFoldersResponse.status})`)
    }

    const foldersData = (await topFoldersResponse.json()) as { data: FolderItem[] }
    const items: Array<{ item_id: string; version_id: string; name: string; urn: string }> =
      []

    for (const folder of foldersData.data ?? []) {
      await listFolderItems(projectId, folder.id, token, items)
    }

    return NextResponse.json({ items })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list items'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    project_id: string
    urn: string
    file_name?: string
    hub_id?: string
    aps_project_id?: string
    item_id?: string
  }

  if (!body.project_id || !body.urn) {
    return NextResponse.json({ error: 'project_id and urn required' }, { status: 400 })
  }

  try {
    const token = await getValidToken(user.id)
    const translation = await ensureModelTranslated(body.urn, token, {
      fileExtension: body.file_name
        ? fileExtensionFromName(body.file_name)
        : undefined,
    })
    const translationStatus =
      translation === 'complete' ? 'complete' : 'processing'

    const { error } = await supabase
      .from('projects')
      .update({
        aps_urn: body.urn,
        aps_hub_id: body.hub_id ?? null,
        aps_project_id: body.aps_project_id ?? null,
        aps_item_id: body.item_id ?? null,
        translation_status: translationStatus,
        source_type: 'aps',
      })
      .eq('id', body.project_id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ urn: body.urn, status: translationStatus })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Translation failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
