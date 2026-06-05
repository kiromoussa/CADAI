import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getValidToken } from '@/lib/aps/auth'

export const dynamic = 'force-dynamic'

interface Hub {
  id: string
  attributes: { name: string }
}

interface Project {
  id: string
  attributes: { name: string }
}

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const token = await getValidToken(user.id)
    const hubsResponse = await fetch(
      'https://developer.api.autodesk.com/project/v1/hubs',
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!hubsResponse.ok) {
      throw new Error(`Failed to list hubs (${hubsResponse.status})`)
    }

    const hubsData = (await hubsResponse.json()) as { data: Hub[] }
    const results: Array<{
      hub_id: string
      hub_name: string
      project_id: string
      project_name: string
    }> = []

    for (const hub of hubsData.data ?? []) {
      const projectsResponse = await fetch(
        `https://developer.api.autodesk.com/project/v1/hubs/${hub.id}/projects`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!projectsResponse.ok) continue

      const projectsData = (await projectsResponse.json()) as { data: Project[] }
      for (const project of projectsData.data ?? []) {
        results.push({
          hub_id: hub.id,
          hub_name: hub.attributes.name,
          project_id: project.id,
          project_name: project.attributes.name,
        })
      }
    }

    return NextResponse.json({ projects: results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list models'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
