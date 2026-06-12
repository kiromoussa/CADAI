'use client'

import { useDemoModal } from '@/components/landing/demo-modal'
import { BlurFade } from '@/components/magicui/blur-fade'

const STEPS = [
  {
    step: '01',
    title: 'Upload or connect',
    body: 'Drop a PDF, start a canvas board, or attach an Autodesk model. Set jurisdiction and occupancy once.',
  },
  {
    step: '02',
    title: 'Analyze in seconds',
    body: 'CodeComply scans plans and model context, cross-referencing applicable sections with AI-assisted review.',
  },
  {
    step: '03',
    title: 'Fix with confidence',
    body: 'Share annotated reports, track pass / warning / violation counts, and re-run after design revisions.',
  },
]

export function WorkflowSection() {
  return (
    <section id="workflow" className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <BlurFade inView direction="up" className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-cyan">Workflow</p>
          <h2 className="mt-3 text-3xl font-semibold text-offwhite md:text-4xl">
            From upload to approved set in three steps
          </h2>
        </BlurFade>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((item, index) => (
            <BlurFade key={item.step} inView delay={0.1 + index * 0.1} direction="up">
              <div className="relative h-full rounded-xl border border-blueprint bg-surface p-6">
                <p className="font-mono text-sm text-cyan">{item.step}</p>
                <h3 className="mt-3 text-lg font-semibold text-offwhite">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-offwhite/60">{item.body}</p>
              </div>
            </BlurFade>
          ))}
        </div>
      </div>
    </section>
  )
}

export function CtaSection() {
  const { openDemo } = useDemoModal()

  return (
    <section className="pb-20 md:pb-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="relative overflow-hidden rounded-2xl border border-blueprint bg-surface px-8 py-14 text-center md:px-16">
          <BlurFade inView direction="up">
            <h2 className="text-3xl font-semibold text-offwhite md:text-4xl">
              Ship compliant drawings faster
            </h2>
          </BlurFade>
          <BlurFade inView delay={0.1} direction="up">
            <p className="mx-auto mt-4 max-w-xl text-offwhite/60">
              Join architects who catch egress, fire separation, and accessibility
              issues before permit submittal, not during plan check.
            </p>
          </BlurFade>
          <BlurFade inView delay={0.2} direction="up">
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={openDemo}
                className="min-w-[200px] rounded-lg bg-cyan px-6 py-3 text-base font-semibold text-white transition hover:bg-rust"
              >
                Request Demo
              </button>
            </div>
          </BlurFade>
        </div>
      </div>
    </section>
  )
}

export function Footer() {
  const { openDemo } = useDemoModal()

  return (
    <footer className="border-t border-blueprint py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-offwhite/40 md:flex-row">
        <p className="font-mono tracking-widest text-offwhite/60">CODECOMPLY</p>
        <p>AI building code compliance for residential architects.</p>
        <div className="flex gap-6">
          <button type="button" onClick={openDemo} className="transition hover:text-offwhite">
            Request Demo
          </button>
        </div>
      </div>
    </footer>
  )
}
