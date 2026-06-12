import type { ViolationRow } from '@/types/database'
import type { ExcalidrawElement, ExcalidrawScene } from '@/types/canvas'

const SEVERITY_COLORS: Record<string, string> = {
  violation: '#EF4444',
  warning: '#F97316',
  pass: '#22C55E',
}

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000)
}

export function violationsToElements(
  violations: ViolationRow[],
  canvasWidth: number,
  canvasHeight: number
): ExcalidrawElement[] {
  const actionable = violations.filter(
    (v) => v.severity === 'violation' || v.severity === 'warning'
  )

  return actionable.map((v, i) => {
    const count = actionable.length
    const col = i % 3
    const row = Math.floor(i / 3)
    const boxW = Math.min(180, canvasWidth * 0.22)
    const boxH = 48
    const margin = 16
    const x = margin + col * (boxW + margin)
    const y = margin + row * (boxH + margin)
    const color = SEVERITY_COLORS[v.severity] ?? '#3B82F6'

    return {
      id: `violation-${v.id}`,
      type: 'rectangle',
      x: Math.min(x, canvasWidth - boxW - margin),
      y: Math.min(y, canvasHeight - boxH - margin),
      width: boxW,
      height: boxH,
      angle: 0,
      strokeColor: color,
      backgroundColor: `${color}33`,
      fillStyle: 'solid',
      strokeWidth: 2,
      roughness: 0,
      opacity: 90,
      groupIds: [],
      frameId: null,
      roundness: { type: 3 },
      seed: randomSeed(),
      version: 1,
      versionNonce: randomSeed(),
      isDeleted: false,
      boundElements: [
        {
          id: `violation-label-${v.id}`,
          type: 'text',
        },
      ],
      updated: Date.now(),
      link: null,
      locked: true,
      customData: { violationId: v.id, severity: v.severity },
    } satisfies ExcalidrawElement
  })
}

export function violationLabelsToElements(
  violations: ViolationRow[],
  rects: ExcalidrawElement[]
): ExcalidrawElement[] {
  const labels: ExcalidrawElement[] = []

  violations
    .filter((v) => v.severity === 'violation' || v.severity === 'warning')
    .forEach((v, i) => {
      const rect = rects[i]
      if (!rect) return
      const label =
        v.element_location ??
        v.element_name ??
        `${v.code_section}: ${v.finding.slice(0, 40)}`

      labels.push({
        id: `violation-label-${v.id}`,
        type: 'text',
        x: rect.x + 8,
        y: rect.y + 14,
        width: rect.width - 16,
        height: 20,
        angle: 0,
        strokeColor: '#F9FAFB',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        roughness: 0,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: randomSeed(),
        version: 1,
        versionNonce: randomSeed(),
        isDeleted: false,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: true,
        text: label.slice(0, 60),
        fontSize: 14,
        fontFamily: 1,
        textAlign: 'left',
        verticalAlign: 'top',
        containerId: rect.id,
        originalText: label,
        lineHeight: 1.25,
        customData: { violationId: v.id },
      } satisfies ExcalidrawElement)
    })

  return labels
}

export function buildViolationOverlayScene(
  violations: ViolationRow[],
  width: number,
  height: number
): ExcalidrawScene {
  const rects = violationsToElements(violations, width, height)
  const labels = violationLabelsToElements(
    violations.filter((v) => v.severity === 'violation' || v.severity === 'warning'),
    rects
  )

  return {
    elements: [...rects, ...labels],
    appState: {
      viewModeEnabled: true,
      zenModeEnabled: true,
      viewBackgroundColor: 'transparent',
    },
    files: {},
  }
}

export function violationIdFromElement(el: ExcalidrawElement): string | null {
  const data = el.customData as { violationId?: string } | undefined
  return data?.violationId ?? null
}
