import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ViewerShell } from '@/components/viewer/ViewerShell'

interface PageProps {
  params: { analysis_id: string }
}

export default async function ViewerPage({ params }: PageProps) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: analysis } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', params.analysis_id)
    .eq('user_id', user.id)
    .single()

  if (!analysis) {
    notFound()
  }

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', analysis.project_id)
    .single()

  if (!project) {
    notFound()
  }

  const { data: violations } = await supabase
    .from('violations')
    .select('*')
    .eq('analysis_id', analysis.id)
    .order('created_at', { ascending: true })

  let pdfUrl: string | null = null
  if (project.pdf_storage_path) {
    const { data: signed } = await supabase.storage
      .from('floor-plans')
      .createSignedUrl(project.pdf_storage_path, 3600)
    pdfUrl = signed?.signedUrl ?? null
  }

  return (
    <ViewerShell
      analysis={analysis}
      project={project}
      violations={violations ?? []}
      pdfUrl={pdfUrl}
    />
  )
}
