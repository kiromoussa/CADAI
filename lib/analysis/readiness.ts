import type { ViolationRow } from '@/types/database'

export type ReadinessRecommendation =
  | 'Ready to Submit'
  | 'Submit with Caution'
  | 'Not Ready'

export interface ReadinessResult {
  readiness_score: number
  recommendation: ReadinessRecommendation
  rationale: string
  critical: number
  major: number
  minor: number
  top_ahj_flags: Array<{
    rank: number
    issue: string
    why_ahj_flags_this: string
    code_citation: string
  }>
  summary_for_client: string
}

function severityWeight(severity: string): 'critical' | 'major' | 'minor' | null {
  if (severity === 'violation') return 'critical'
  if (severity === 'warning') return 'major'
  return null
}

export function computeReadinessScore(violations: ViolationRow[]): ReadinessResult {
  const issues = violations.filter((v) => v.severity !== 'pass')
  let critical = 0
  let major = 0
  let minor = 0

  for (const v of issues) {
    const weight = severityWeight(v.severity)
    if (weight === 'critical') critical += 1
    else if (weight === 'major') major += 1
    else minor += 1
  }

  const readiness_score = Math.max(0, 100 - critical * 20 - major * 8 - minor * 2)

  let recommendation: ReadinessRecommendation
  if (readiness_score >= 85 && critical === 0) {
    recommendation = 'Ready to Submit'
  } else if (readiness_score >= 70) {
    recommendation = 'Submit with Caution'
  } else {
    recommendation = 'Not Ready'
  }

  const sorted = [...issues].sort((a, b) => {
    const rank = (s: string) => (s === 'violation' ? 0 : s === 'warning' ? 1 : 2)
    return rank(a.severity) - rank(b.severity)
  })

  const top_ahj_flags = sorted.slice(0, 5).map((v, i) => ({
    rank: i + 1,
    issue: v.finding,
    why_ahj_flags_this:
      v.severity === 'violation'
        ? 'Clear code non-compliance that plan reviewers routinely reject.'
        : 'Common reviewer flag — may require clarification or revision.',
    code_citation: v.code_section,
  }))

  const rationale =
    critical > 0
      ? `${critical} critical violation${critical === 1 ? '' : 's'} must be resolved before submission.`
      : major > 0
        ? `${major} warning${major === 1 ? '' : 's'} should be addressed to reduce AHJ review delays.`
        : 'No significant compliance issues detected in this pass.'

  const summary_for_client =
    recommendation === 'Ready to Submit'
      ? 'The plan set appears ready for permit submission based on this automated review. A licensed professional should still verify all findings.'
      : recommendation === 'Submit with Caution'
        ? 'The plan set is close to submission-ready but has items that may trigger reviewer comments. Address flagged issues before filing.'
        : 'The plan set has significant compliance gaps. Resolve critical findings before submitting to the building department.'

  return {
    readiness_score,
    recommendation,
    rationale,
    critical,
    major,
    minor,
    top_ahj_flags,
    summary_for_client,
  }
}
