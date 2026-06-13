import clsx from 'clsx'

interface FirstPassScorePillProps {
  score: number | null | undefined
  recommendation?: string | null
  size?: 'sm' | 'md'
}

const tone = (score: number) => {
  if (score >= 85) return 'text-severity-pass border-severity-pass/40 bg-severity-pass/10'
  if (score >= 70) return 'text-severity-warning border-severity-warning/40 bg-severity-warning/10'
  return 'text-severity-violation border-severity-violation/40 bg-severity-violation/10'
}

export function FirstPassScorePill({
  score,
  recommendation,
  size = 'sm',
}: FirstPassScorePillProps) {
  if (score == null) return null

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-2 rounded-md border font-mono',
        tone(score),
        size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-xs'
      )}
    >
      <span className="font-semibold">FirstPass {score}</span>
      {recommendation && (
        <span className="font-sans font-normal opacity-80">{recommendation}</span>
      )}
    </div>
  )
}
