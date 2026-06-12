import Link from 'next/link'
import { redirect } from 'next/navigation'
import { signOut } from '@/app/actions/auth'
import { DeleteProjectButton } from '@/components/DeleteProjectButton'
import { createClient } from '@/lib/supabase/server'
import { NewBoardButton } from '@/components/canvas/NewBoardButton'
import type { AnalysisRow, CanvasBoardRow, ProjectRow } from '@/types/database'

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, firm_name, aps_access_token')
    .eq('id', user.id)
    .single()

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: boards } = await supabase
    .from('canvas_boards')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(20)

  const boardList = (boards ?? []) as CanvasBoardRow[]
  const projectList = (projects ?? []) as ProjectRow[]
  const projectIds = projectList.map((p) => p.id)

  let analysesByProject = new Map<string, AnalysisRow>()
  if (projectIds.length > 0) {
    const { data: analyses } = await supabase
      .from('analyses')
      .select('*')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false })

    for (const analysis of analyses ?? []) {
      const row = analysis as AnalysisRow
      if (!analysesByProject.has(row.project_id)) {
        analysesByProject.set(row.project_id, row)
      }
    }
  }

  return (
    <main className="min-h-screen bg-navy">
      <header className="border-b border-blueprint px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="font-mono text-sm text-cyan">
            CodeComply
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="font-mono text-sm text-offwhite/60 transition hover:text-cyan"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl font-semibold text-offwhite">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
        </h1>
        {profile?.firm_name && (
          <p className="mt-1 font-mono text-sm text-offwhite/60">{profile.firm_name}</p>
        )}

        {!profile?.aps_access_token && (
          <div className="mt-8 rounded-lg border border-blueprint bg-blueprint/20 p-6">
            <p className="font-mono text-xs uppercase text-cyan">Autodesk not connected</p>
            <p className="mt-2 text-offwhite/70">
              Connect your Autodesk account to analyze Revit models directly.
            </p>
            <Link
              href="/api/aps/oauth"
              className="mt-4 inline-block rounded-md border border-cyan px-4 py-2 text-sm text-cyan transition hover:bg-cyan/10"
            >
              Connect Autodesk
            </Link>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/analyze"
            className="rounded-md bg-accent px-6 py-3 font-medium text-white transition hover:bg-accent/90"
          >
            New analysis
          </Link>
          <NewBoardButton />
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-medium text-offwhite">Compliance boards</h2>
          {boardList.length === 0 ? (
            <p className="mt-4 text-offwhite/60">
              Create a board to arrange PDFs and run compliance checks on a canvas.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-blueprint rounded-lg border border-blueprint">
              {boardList.map((board) => (
                <li
                  key={board.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-4 py-4"
                >
                  <div>
                    <p className="font-medium text-offwhite">{board.title}</p>
                    <p className="mt-1 text-sm text-offwhite/60">
                      {board.default_city}, {board.default_state} ·{' '}
                      {board.default_project_type}
                    </p>
                    <p className="mt-1 text-xs text-offwhite/50">
                      Updated{' '}
                      {new Date(board.updated_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <Link
                    href={`/board/${board.id}`}
                    className="rounded-md border border-cyan px-4 py-2 text-sm text-cyan transition hover:bg-cyan/10"
                  >
                    Open board
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-medium text-offwhite">Recent projects</h2>
          {projectList.length === 0 ? (
            <p className="mt-4 text-offwhite/60">
              Your projects will appear here once you run an analysis.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-blueprint rounded-lg border border-blueprint">
              {projectList.map((project) => {
                const analysis = analysesByProject.get(project.id)
                return (
                  <li
                    key={project.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-4 py-4"
                  >
                    <div>
                      <p className="font-medium text-offwhite">{project.name}</p>
                      <p className="mt-1 text-sm text-offwhite/60">
                        {project.city}, {project.state} · {project.project_type} ·{' '}
                        {project.source_type.toUpperCase()}
                        {project.translation_status !== 'complete' &&
                          project.source_type === 'aps' && (
                            <span className="ml-2 text-amber-400">
                              · translation {project.translation_status}
                            </span>
                          )}
                      </p>
                      {analysis && (
                        <p className="mt-1 text-xs text-offwhite/50">
                          Last run{' '}
                          {new Date(analysis.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                          {' · '}
                          {analysis.violation_count} violations, {analysis.warning_count}{' '}
                          warnings
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {analysis?.status === 'complete' ? (
                        <Link
                          href={`/viewer/${analysis.id}`}
                          className="rounded-md border border-cyan px-4 py-2 text-sm text-cyan transition hover:bg-cyan/10"
                        >
                          Open viewer
                        </Link>
                      ) : analysis ? (
                        <span className="text-sm capitalize text-offwhite/50">
                          {analysis.status === 'error' ? 'Failed' : analysis.status}
                        </span>
                      ) : (
                        <span className="text-sm text-offwhite/40">
                          {project.translation_status !== 'complete' &&
                          project.source_type === 'aps'
                            ? `Translation ${project.translation_status}`
                            : 'No analysis yet'}
                        </span>
                      )}
                      <DeleteProjectButton
                        projectId={project.id}
                        projectName={project.name}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
