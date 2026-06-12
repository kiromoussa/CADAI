'use client'

import { useEffect, useState } from 'react'
import { ExcalidrawWrapper } from '@/components/viewer/ExcalidrawWrapper'
import { buildViolationOverlayScene } from '@/lib/excalidraw/violationToElements'
import type { ExcalidrawScene } from '@/types/canvas'
import type { ViolationRow } from '@/types/database'

interface ExcalidrawOverlayProps {
  analysisId: string
  violations: ViolationRow[]
  sheetGuid?: string | null
  onViolationSelect?: (violationId: string) => void
}

export function ExcalidrawOverlay({
  analysisId,
  violations,
  sheetGuid,
}: ExcalidrawOverlayProps) {
  const [scene, setScene] = useState<ExcalidrawScene | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const params = sheetGuid ? `?sheet_guid=${encodeURIComponent(sheetGuid)}` : ''
      const res = await fetch(`/api/analyses/${analysisId}/annotations${params}`)
      if (!res.ok) return
      const data = (await res.json()) as {
        annotation?: { scene_json: ExcalidrawScene } | null
        generated_scene?: ExcalidrawScene
      }

      if (cancelled) return

      if (data.annotation?.scene_json) {
        setScene(data.annotation.scene_json as ExcalidrawScene)
      } else if (data.generated_scene) {
        setScene(data.generated_scene)
      } else {
        const filtered = sheetGuid
          ? violations.filter((v) => !v.sheet_guid || v.sheet_guid === sheetGuid)
          : violations
        setScene(buildViolationOverlayScene(filtered, 1200, 900))
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [analysisId, violations, sheetGuid])

  if (!scene || scene.elements.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <ExcalidrawWrapper scene={scene} className="h-full w-full opacity-90" />
    </div>
  )
}
