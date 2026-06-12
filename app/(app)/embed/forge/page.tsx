'use client'

import dynamic from 'next/dynamic'

const ForgeViewer = dynamic(
  () => import('@/components/viewer/ForgeViewer').then((m) => m.ForgeViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full flex-col items-center justify-center bg-[#1e1e1e]">
        <div className="h-8 w-48 animate-pulse rounded bg-[#2d2d30]" />
        <p className="mt-4 text-sm text-[#9ca3af]">Loading drawing…</p>
      </div>
    ),
  }
)

interface PageProps {
  searchParams: { urn?: string }
}

export default function EmbedForgePage({ searchParams }: PageProps) {
  const urn = searchParams.urn?.trim()

  if (!urn) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1e1e1e] text-sm text-[#9ca3af]">
        Missing drawing URN.
      </div>
    )
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#1e1e1e]">
      <ForgeViewer
        compact
        urn={urn}
        violations={[]}
        selectedId={null}
        onSelect={() => {}}
        locateViolation={null}
      />
    </div>
  )
}
