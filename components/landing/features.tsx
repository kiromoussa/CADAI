'use client'

import { useDemoModal } from '@/components/landing/demo-modal'
import { BlurFade } from '@/components/magicui/blur-fade'

const FEATURES = [
  {
    number: '01',
    title: 'Canvas board',
    subtitle: 'Your entire project on one infinite board',
    description:
      'Drop PDFs, embed live 3D Forge models, and run code compliance checks side by side. Board tools add plan chat, code interpreter, checklist review, and version diff — all without leaving the canvas.',
    capabilities: [
      'Drag-and-drop PDF sheets and CAD models onto the canvas',
      'Embed live Autodesk Forge 3D viewers',
      'Run compliance checks from any plan node',
      'Plan chat, code interpreter, and checklist review in Board tools',
      'Version diff between compliance runs on the same board',
      'Sticky notes for reviewer comments and team coordination',
      'Export markdown compliance reports from the board toolbar',
    ],
  },
  {
    number: '02',
    title: 'Instant code compliance',
    subtitle: 'Every applicable code section, checked automatically',
    description:
      'Upload a floor plan and CodeComply cross-references IBC, IRC, ADA, NFPA, and local amendments in under 60 seconds. Each finding is severity-ranked with the exact code citation, plain-English explanation, and resolution pathways.',
    capabilities: [
      'IBC, IRC, ADA/A117.1, NFPA 101, Title 24',
      'Violation, warning, and pass severity levels',
      'Exact code section citations for every finding',
      'Resolution pathways with design and cost tradeoffs',
      'Pre-submission readiness score before permit filing',
      'Re-run after revisions to track progress',
    ],
  },
  {
    number: '03',
    title: 'Autodesk Forge integration',
    subtitle: 'Navigate violations in your actual 3D model',
    description:
      'Connect your Autodesk account and CodeComply translates your Revit models directly. Violations are pinned to specific elements in the 3D viewer so you can orbit, zoom, and see exactly what needs to change.',
    capabilities: [
      'Direct Revit model translation',
      'Violations pinned to 3D model elements',
      'Sheet-by-sheet navigation with discipline labels',
      'Forge viewer embedded in canvas boards',
      'Works with DWG, RVT, and IFC files',
    ],
  },
  {
    number: '04',
    title: 'Plain-English reports',
    subtitle: 'Reports your clients and contractors can actually read',
    description:
      'No jargon-heavy code references buried in a spreadsheet. Every violation is explained in clear language with the rule reference, readiness score, top AHJ flags, and resolution pathways. Export markdown reports from the viewer or board.',
    capabilities: [
      'Human-readable violation explanations',
      'Pre-submission readiness score and AHJ flag predictions',
      'Resolution pathways with recommended options',
      'Grouped by severity and discipline',
      'Exportable markdown for client and permit review',
      'Plan chat for cited answers about your specific plan',
      'Track violation counts across revisions with version diff',
    ],
  },
]

export function FeaturesSection() {
  const { openDemo } = useDemoModal()

  return (
    <section id="features" className="relative bg-surface py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <BlurFade inView direction="up" className="mx-auto max-w-3xl text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-cyan">Features</p>
          <h2 className="mt-3 text-3xl font-semibold text-offwhite md:text-4xl">
            Resolution-first plan review on a compliance board
          </h2>
          <p className="mt-4 text-offwhite/60">
            Every issue ships with resolution pathways. Every run ends with a FirstPass
            Readiness Score. Built for lean firms doing multifamily and mixed-use.
          </p>
        </BlurFade>

        <div className="mt-16 space-y-6">
          {FEATURES.map((feature, index) => (
            <BlurFade key={feature.number} inView delay={0.08 * index} direction="up">
              <div className="rounded-xl border border-blueprint bg-navy p-8 md:p-10">
                <div className="flex flex-col gap-8 md:flex-row md:gap-12">
                  <div className="flex-1">
                    <p className="font-mono text-sm text-cyan">{feature.number}</p>
                    <h3 className="mt-2 text-2xl font-semibold text-offwhite md:text-3xl">
                      {feature.title}
                    </h3>
                    <p className="mt-1 text-lg text-cyan/80">{feature.subtitle}</p>
                    <p className="mt-4 leading-relaxed text-offwhite/60">
                      {feature.description}
                    </p>
                    <button
                      type="button"
                      onClick={openDemo}
                      className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-cyan transition hover:underline"
                    >
                      See it in action <span aria-hidden>→</span>
                    </button>
                  </div>
                  <div className="md:w-80">
                    <ul className="space-y-3">
                      {feature.capabilities.map((cap) => (
                        <li key={cap} className="flex items-start gap-3 text-sm text-offwhite/70">
                          <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                          {cap}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </BlurFade>
          ))}
        </div>
      </div>
    </section>
  )
}
