/**
 * First-party CADAI compliance library for Excalidraw.
 *
 * All shapes are generated in the native Excalidraw aesthetic — hand-drawn
 * roughness, the hand-drawn font (fontFamily 1), and hachure fills — using the
 * same severity palette as `lib/excalidraw/violationToElements.ts`.
 */

// Severity palette shared with violation overlays.
const COLOR_VIOLATION = '#EF4444'
const COLOR_WARNING = '#F97316'
const COLOR_PASS = '#22C55E'
const COLOR_ACCENT = '#3B82F6'
const COLOR_INK = '#1e1e1e'

type AnyElement = Record<string, unknown>

export interface CadaiLibraryItem {
  id: string
  status: 'published'
  created: number
  name: string
  elements: AnyElement[]
}

let seedCounter = 1
function seed(): number {
  // Deterministic so the library renders identically across loads.
  seedCounter = (seedCounter * 16807) % 2147483647
  return seedCounter
}

const CREATED_AT = 1717200000000

function baseElement(overrides: AnyElement): AnyElement {
  return {
    angle: 0,
    fillStyle: 'hachure',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    seed: seed(),
    version: 1,
    versionNonce: seed(),
    isDeleted: false,
    boundElements: null,
    updated: CREATED_AT,
    link: null,
    locked: false,
    ...overrides,
  }
}

function rect(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  strokeColor: string,
  backgroundColor: string,
  overrides: AnyElement = {}
): AnyElement {
  return baseElement({
    id,
    type: 'rectangle',
    x,
    y,
    width,
    height,
    strokeColor,
    backgroundColor,
    roundness: { type: 3 },
    ...overrides,
  })
}

function ellipse(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  strokeColor: string,
  backgroundColor: string,
  overrides: AnyElement = {}
): AnyElement {
  return baseElement({
    id,
    type: 'ellipse',
    x,
    y,
    width,
    height,
    strokeColor,
    backgroundColor,
    roundness: null,
    ...overrides,
  })
}

function text(
  id: string,
  x: number,
  y: number,
  content: string,
  options: {
    color?: string
    fontSize?: number
    width?: number
    textAlign?: 'left' | 'center' | 'right'
  } = {}
): AnyElement {
  const fontSize = options.fontSize ?? 16
  const width = options.width ?? content.length * fontSize * 0.6
  return baseElement({
    id,
    type: 'text',
    x,
    y,
    width,
    height: fontSize * 1.25,
    strokeColor: options.color ?? COLOR_INK,
    backgroundColor: 'transparent',
    roundness: null,
    text: content,
    originalText: content,
    fontSize,
    fontFamily: 1, // hand-drawn (Excalifont)
    textAlign: options.textAlign ?? 'left',
    verticalAlign: 'top',
    containerId: null,
    lineHeight: 1.25,
    autoResize: true,
  })
}

function line(
  id: string,
  x: number,
  y: number,
  points: [number, number][],
  strokeColor: string,
  overrides: AnyElement = {}
): AnyElement {
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  return baseElement({
    id,
    type: 'line',
    x,
    y,
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
    strokeColor,
    backgroundColor: 'transparent',
    roundness: null,
    points,
    lastCommittedPoint: null,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: null,
    ...overrides,
  })
}

function arrow(
  id: string,
  x: number,
  y: number,
  points: [number, number][],
  strokeColor: string,
  overrides: AnyElement = {}
): AnyElement {
  return {
    ...line(id, x, y, points, strokeColor, overrides),
    type: 'arrow',
    endArrowhead: 'arrow',
    elbowed: false,
  }
}

function grouped(groupId: string, elements: AnyElement[]): AnyElement[] {
  return elements.map((el) => ({ ...el, groupIds: [groupId] }))
}

// ---------------------------------------------------------------------------
// Library items
// ---------------------------------------------------------------------------

function violationMarker(): CadaiLibraryItem {
  return {
    id: 'cadai-violation-marker',
    status: 'published',
    created: CREATED_AT,
    name: 'Violation marker',
    elements: grouped('g-violation', [
      rect('viol-box', 0, 0, 170, 44, COLOR_VIOLATION, `${COLOR_VIOLATION}33`, {
        fillStyle: 'solid',
      }),
      text('viol-text', 12, 12, 'VIOLATION § ___', {
        color: COLOR_VIOLATION,
        fontSize: 16,
      }),
    ]),
  }
}

function warningMarker(): CadaiLibraryItem {
  return {
    id: 'cadai-warning-marker',
    status: 'published',
    created: CREATED_AT,
    name: 'Warning marker',
    elements: grouped('g-warning', [
      rect('warn-box', 0, 0, 170, 44, COLOR_WARNING, `${COLOR_WARNING}33`, {
        fillStyle: 'solid',
      }),
      text('warn-text', 12, 12, 'WARNING § ___', {
        color: COLOR_WARNING,
        fontSize: 16,
      }),
    ]),
  }
}

function passBadge(): CadaiLibraryItem {
  return {
    id: 'cadai-pass-badge',
    status: 'published',
    created: CREATED_AT,
    name: 'Compliant badge',
    elements: grouped('g-pass', [
      ellipse('pass-circle', 0, 0, 48, 48, COLOR_PASS, `${COLOR_PASS}26`),
      line(
        'pass-check',
        12,
        24,
        [
          [0, 0],
          [9, 10],
          [25, -12],
        ],
        COLOR_PASS,
        { strokeWidth: 4 }
      ),
      text('pass-text', 56, 14, 'Compliant', { color: COLOR_PASS, fontSize: 16 }),
    ]),
  }
}

function failBadge(): CadaiLibraryItem {
  return {
    id: 'cadai-fail-badge',
    status: 'published',
    created: CREATED_AT,
    name: 'Non-compliant badge',
    elements: grouped('g-fail', [
      ellipse('fail-circle', 0, 0, 48, 48, COLOR_VIOLATION, `${COLOR_VIOLATION}26`),
      line(
        'fail-x1',
        14,
        14,
        [
          [0, 0],
          [20, 20],
        ],
        COLOR_VIOLATION,
        { strokeWidth: 4 }
      ),
      line(
        'fail-x2',
        34,
        14,
        [
          [0, 0],
          [-20, 20],
        ],
        COLOR_VIOLATION,
        { strokeWidth: 4 }
      ),
      text('fail-text', 56, 14, 'Non-compliant', {
        color: COLOR_VIOLATION,
        fontSize: 16,
      }),
    ]),
  }
}

function codeSectionCallout(): CadaiLibraryItem {
  return {
    id: 'cadai-code-callout',
    status: 'published',
    created: CREATED_AT,
    name: 'Code section callout',
    elements: grouped('g-callout', [
      rect('callout-box', 0, 0, 190, 56, COLOR_ACCENT, `${COLOR_ACCENT}1A`, {
        fillStyle: 'solid',
      }),
      line(
        'callout-tail',
        24,
        56,
        [
          [0, 0],
          [-14, 22],
          [14, 2],
        ],
        COLOR_ACCENT
      ),
      text('callout-section', 12, 8, '§ R311.7.5', {
        color: COLOR_ACCENT,
        fontSize: 16,
      }),
      text('callout-note', 12, 30, 'Code note...', {
        color: COLOR_INK,
        fontSize: 13,
      }),
    ]),
  }
}

function egressPath(): CadaiLibraryItem {
  return {
    id: 'cadai-egress-path',
    status: 'published',
    created: CREATED_AT,
    name: 'Egress path',
    elements: grouped('g-egress', [
      arrow(
        'egress-arrow',
        0,
        30,
        [
          [0, 0],
          [70, -18],
          [150, 6],
          [220, -10],
        ],
        COLOR_PASS,
        { strokeWidth: 3, strokeStyle: 'dashed' }
      ),
      text('egress-label', 78, 34, 'EGRESS', { color: COLOR_PASS, fontSize: 15 }),
    ]),
  }
}

function exitDoor(): CadaiLibraryItem {
  return {
    id: 'cadai-exit-door',
    status: 'published',
    created: CREATED_AT,
    name: 'Exit door',
    elements: grouped('g-exit', [
      // Wall segments either side of the opening
      line(
        'exit-wall-l',
        0,
        60,
        [
          [0, 0],
          [26, 0],
        ],
        COLOR_INK,
        { strokeWidth: 3 }
      ),
      line(
        'exit-wall-r',
        76,
        60,
        [
          [0, 0],
          [26, 0],
        ],
        COLOR_INK,
        { strokeWidth: 3 }
      ),
      // Door leaf
      line(
        'exit-leaf',
        26,
        60,
        [
          [0, 0],
          [0, -50],
        ],
        COLOR_INK,
        { strokeWidth: 2 }
      ),
      // Swing arc (approximated with a curved multi-point line)
      line(
        'exit-swing',
        26,
        10,
        [
          [0, 0],
          [22, 4],
          [40, 18],
          [50, 50],
        ],
        COLOR_INK,
        { strokeWidth: 1, strokeStyle: 'dashed' }
      ),
      rect('exit-sign', 22, 70, 58, 26, COLOR_PASS, `${COLOR_PASS}26`, {
        fillStyle: 'solid',
      }),
      text('exit-text', 32, 75, 'EXIT', { color: COLOR_PASS, fontSize: 14 }),
    ]),
  }
}

function reviewStamp(
  id: string,
  name: string,
  label: string,
  color: string
): CadaiLibraryItem {
  const width = Math.max(150, label.length * 13 + 40)
  return {
    id,
    status: 'published',
    created: CREATED_AT,
    name,
    elements: grouped(`g-${id}`, [
      ellipse(`${id}-ring`, 0, 0, width, 58, color, 'transparent', {
        strokeWidth: 3,
        angle: -0.08,
      }),
      text(`${id}-label`, width / 2 - label.length * 5.4, 20, label, {
        color,
        fontSize: 18,
        textAlign: 'center',
      }),
    ]),
  }
}

function complianceReportList(): CadaiLibraryItem {
  const W = 320
  const rowYs = [86, 128, 170]
  const rowColors = [COLOR_PASS, COLOR_WARNING, COLOR_VIOLATION]
  const rowLabels = [
    '§ R311.7  Stair width — pass',
    '§ R303.1  Light + vent — verify',
    '§ R310.1  Egress window — fail',
  ]
  const rowMarks = ['✓', '!', '✗']

  const rows: AnyElement[] = rowYs.flatMap((y, i) => [
    ellipse(
      `report-dot-${i}`,
      18,
      y,
      26,
      26,
      rowColors[i],
      `${rowColors[i]}26`,
      { strokeWidth: 2 }
    ),
    text(`report-mark-${i}`, 26, y + 4, rowMarks[i], {
      color: rowColors[i],
      fontSize: 15,
    }),
    text(`report-row-${i}`, 56, y + 4, rowLabels[i], {
      color: COLOR_INK,
      fontSize: 14,
    }),
  ])

  return {
    id: 'cadai-compliance-report',
    status: 'published',
    created: CREATED_AT,
    name: 'Compliance report list',
    elements: grouped('g-report', [
      rect('report-card', 0, 0, W, 224, COLOR_INK, '#ffffff', {
        fillStyle: 'solid',
        strokeWidth: 2,
      }),
      text('report-title', 18, 16, 'Compliance Report', {
        color: COLOR_INK,
        fontSize: 20,
      }),
      text('report-sub', 18, 46, 'IRC 2024 · Residential', {
        color: '#6b7280',
        fontSize: 13,
      }),
      line(
        'report-divider',
        14,
        72,
        [
          [0, 0],
          [W - 28, 0],
        ],
        '#9ca3af',
        { strokeWidth: 1 }
      ),
      ...rows,
      line(
        'report-footer-divider',
        14,
        204,
        [
          [0, 0],
          [W - 28, 0],
        ],
        '#9ca3af',
        { strokeWidth: 1 }
      ),
      text('report-footer', 18, 207, '1 pass · 1 warning · 1 violation', {
        color: '#6b7280',
        fontSize: 12,
      }),
    ]),
  }
}

function severityLegend(): CadaiLibraryItem {
  const entries: Array<[string, string]> = [
    ['Violation', COLOR_VIOLATION],
    ['Warning', COLOR_WARNING],
    ['Pass', COLOR_PASS],
  ]
  const elements: AnyElement[] = [
    rect('legend-card', 0, 0, 150, 118, COLOR_INK, '#ffffff', {
      fillStyle: 'solid',
      strokeWidth: 1,
    }),
    text('legend-title', 14, 10, 'Legend', { color: COLOR_INK, fontSize: 15 }),
  ]
  entries.forEach(([label, color], i) => {
    const y = 40 + i * 26
    elements.push(
      rect(`legend-swatch-${i}`, 14, y, 18, 18, color, `${color}40`, {
        fillStyle: 'solid',
        strokeWidth: 1,
      }),
      text(`legend-label-${i}`, 42, y + 1, label, { color: COLOR_INK, fontSize: 14 })
    )
  })
  return {
    id: 'cadai-severity-legend',
    status: 'published',
    created: CREATED_AT,
    name: 'Severity legend',
    elements: grouped('g-legend', elements),
  }
}

/** The full first-party CADAI compliance library. */
export function buildCadaiComplianceLibrary(): CadaiLibraryItem[] {
  return [
    violationMarker(),
    warningMarker(),
    passBadge(),
    failBadge(),
    codeSectionCallout(),
    egressPath(),
    exitDoor(),
    reviewStamp('cadai-stamp-approved', 'Approved stamp', 'APPROVED', COLOR_PASS),
    reviewStamp(
      'cadai-stamp-needs-review',
      'Needs review stamp',
      'NEEDS REVIEW',
      COLOR_WARNING
    ),
    reviewStamp('cadai-stamp-rejected', 'Rejected stamp', 'REJECTED', COLOR_VIOLATION),
    complianceReportList(),
    severityLegend(),
  ]
}
