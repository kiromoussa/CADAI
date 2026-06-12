import type { AnalysisRow, ProjectRow, ViolationRow } from '@/types/database'
import { computeReadinessScore } from '@/lib/analysis/readiness'
import { disciplineLabel } from '@/lib/analysis/disciplines'
import type { Discipline } from '@/types/analysis'

export function generateComplianceReportMarkdown(
  project: ProjectRow,
  analysis: AnalysisRow,
  violations: ViolationRow[],
  reviewerFirm?: string
): string {
  const readiness = computeReadinessScore(violations)
  const reviewDate = analysis.completed_at
    ? new Date(analysis.completed_at).toLocaleDateString()
    : new Date(analysis.created_at).toLocaleDateString()

  const issues = violations.filter((v) => v.severity !== 'pass')
  const sorted = [...issues].sort((a, b) => {
    const rank = (s: string) => (s === 'violation' ? 0 : s === 'warning' ? 1 : 2)
    return rank(a.severity) - rank(b.severity)
  })

  const lines: string[] = [
    `# Compliance Report — ${project.name}`,
    '',
    `| Field | Value |`,
    `| --- | --- |`,
    `| Date | ${reviewDate} |`,
    `| Jurisdiction | ${project.city}, ${project.state} |`,
    `| Project type | ${analysis.project_type} |`,
    `| Reviewer | ${reviewerFirm ?? 'CodeComply AI-assisted review'} |`,
    `| Readiness score | **${readiness.readiness_score}/100** (${readiness.recommendation}) |`,
    '',
    '## Executive Summary',
    '',
    readiness.summary_for_client,
    '',
    `This review identified **${analysis.violation_count} violations**, **${analysis.warning_count} warnings**, and **${analysis.pass_count} passed checks**.`,
    '',
    '## Findings by Severity',
    '',
    '| Severity | Code | Title | Finding | Recommendation |',
    '| --- | --- | --- | --- | --- |',
  ]

  for (const v of sorted) {
    const finding = v.finding.replace(/\|/g, '\\|').slice(0, 120)
    const rec = v.recommendation.replace(/\|/g, '\\|').slice(0, 120)
    lines.push(
      `| ${v.severity} | ${v.code_section} | ${v.code_title.replace(/\|/g, '\\|')} | ${finding} | ${rec} |`
    )
  }

  if (readiness.top_ahj_flags.length > 0) {
    lines.push('', '## Top AHJ Flags', '')
    for (const flag of readiness.top_ahj_flags) {
      lines.push(
        `${flag.rank}. **${flag.code_citation}** — ${flag.issue}\n   - ${flag.why_ahj_flags_this}`
      )
    }
  }

  const byDiscipline = new Map<string, ViolationRow[]>()
  for (const v of sorted) {
    const d = (v.discipline as Discipline) ?? 'general'
    const list = byDiscipline.get(d) ?? []
    list.push(v)
    byDiscipline.set(d, list)
  }

  if (byDiscipline.size > 1) {
    lines.push('', '## By Discipline', '')
    for (const [d, items] of Array.from(byDiscipline.entries())) {
      lines.push(`### ${disciplineLabel(d as Discipline)} (${items.length})`, '')
      for (const v of items) {
        lines.push(`- **${v.code_section}** — ${v.finding}`)
      }
      lines.push('')
    }
  }

  lines.push(
    '---',
    '',
    '*This AI-assisted review identifies probable compliance issues for team action. All findings require verification by a licensed design professional and are subject to AHJ interpretation.*'
  )

  return lines.join('\n')
}
