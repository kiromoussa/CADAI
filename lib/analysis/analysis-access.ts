import { createClient } from '@/lib/supabase/server'
import type { AnalysisRow, ProjectRow } from '@/types/database'

export async function getAnalysisForUser(
  analysisId: string,
  userId: string
): Promise<{ analysis: AnalysisRow; project: ProjectRow } | null> {
  const supabase = createClient()

  const { data: analysis } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', analysisId)
    .eq('user_id', userId)
    .single()

  if (!analysis) return null

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', analysis.project_id)
    .single()

  if (!project) return null

  return { analysis: analysis as AnalysisRow, project: project as ProjectRow }
}
