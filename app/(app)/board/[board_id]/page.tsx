import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BoardPageClient from './BoardPageClient'
import type { CanvasNodeRow } from '@/types/database'

interface PageProps {
  params: { board_id: string }
}

export default async function BoardPage({ params }: PageProps) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: board } = await supabase
    .from('canvas_boards')
    .select('*')
    .eq('id', params.board_id)
    .eq('user_id', user.id)
    .single()

  if (!board) {
    notFound()
  }

  const { data: nodes } = await supabase
    .from('canvas_nodes')
    .select('*')
    .eq('board_id', params.board_id)
    .order('created_at', { ascending: true })

  const nodeList = (nodes ?? []) as CanvasNodeRow[]
  const pdfUrls: Record<string, string | null> = {}
  const projectUrns: Record<string, string | null> = {}

  const projectIds = Array.from(
    new Set(
      nodeList
        .filter((n) => n.node_type === 'forge' && n.project_id)
        .map((n) => n.project_id as string)
    )
  )

  if (projectIds.length > 0) {
    const { data: projects } = await supabase
      .from('projects')
      .select('id, aps_urn')
      .in('id', projectIds)

    for (const project of projects ?? []) {
      projectUrns[project.id] = project.aps_urn
    }
  }

  for (const node of nodeList) {
    if (node.storage_path) {
      const { data: signed } = await supabase.storage
        .from('floor-plans')
        .createSignedUrl(node.storage_path, 3600)
      pdfUrls[node.id] = signed?.signedUrl ?? null
    }
  }

  return (
    <BoardPageClient
      board={board}
      initialNodes={nodeList}
      initialPdfUrls={pdfUrls}
      initialProjectUrns={projectUrns}
    />
  )
}
