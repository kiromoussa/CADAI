import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAnalysisForUser } from '@/lib/analysis/analysis-access'
import { generateComplianceReportMarkdown } from '@/lib/analysis/report-export'

export const runtime = 'nodejs'

interface RouteParams {
  params: { id: string }
}

export async function GET(request: Request, { params }: RouteParams) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ctx = await getAnalysisForUser(params.id, user.id)
  if (!ctx) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('firm_name')
    .eq('id', user.id)
    .single()

  const { data: violations } = await supabase
    .from('violations')
    .select('*')
    .eq('analysis_id', params.id)
    .order('created_at', { ascending: true })

  const markdown = generateComplianceReportMarkdown(
    ctx.project,
    ctx.analysis,
    violations ?? [],
    profile?.firm_name ?? undefined
  )

  const url = new URL(request.url)
  const format = url.searchParams.get('format')

  if (format === 'json') {
    return NextResponse.json({ markdown })
  }

  const filename = `${ctx.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-compliance-report.md`

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
