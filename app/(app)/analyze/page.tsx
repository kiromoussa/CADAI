import { Suspense } from 'react'
import AnalyzePageClient from './AnalyzePageClient'

export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-text-secondary">
          Loading…
        </div>
      }
    >
      <AnalyzePageClient />
    </Suspense>
  )
}
