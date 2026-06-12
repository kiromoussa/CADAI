'use client'

import Link from 'next/link'
import { useDemoModal } from '@/components/landing/demo-modal'
import { BlurFade } from '@/components/magicui/blur-fade'

function Nav() {
  const { openDemo } = useDemoModal()

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-blueprint/60 bg-navy/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-mono text-sm font-semibold tracking-widest text-cyan">
          CODECOMPLY
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-offwhite/60 md:flex">
          <a href="#features" className="transition hover:text-offwhite">
            Features
          </a>
          <a href="#workflow" className="transition hover:text-offwhite">
            Workflow
          </a>
          <a href="#standards" className="transition hover:text-offwhite">
            Standards
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openDemo}
            className="rounded-lg bg-cyan px-5 py-2.5 text-sm font-medium text-white transition hover:bg-rust"
          >
            Request Demo
          </button>
        </div>
      </div>
    </header>
  )
}

function Hero() {
  const { openDemo } = useDemoModal()

  return (
    <section className="relative overflow-hidden bg-grid-pattern bg-grid pt-28 pb-16 md:pt-32 md:pb-20">
      <div className="relative mx-auto max-w-6xl px-6 text-center">
        <BlurFade delay={0.05} direction="up" offset={10}>
          <p className="mb-5 font-mono text-xs font-medium uppercase tracking-widest text-offwhite/40">
            Cities take 2-4 weeks to flag code violations. You don't have to.
          </p>
        </BlurFade>

        <BlurFade delay={0.12} direction="up" offset={14}>
          <h1 className="mx-auto max-w-4xl text-4xl font-semibold tracking-tight text-offwhite md:text-6xl md:leading-[1.1]">
            Code compliance in <span className="text-cyan">minutes</span>, not weeks
          </h1>
        </BlurFade>
        <BlurFade delay={0.2} direction="up" offset={12}>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-offwhite/60 md:text-xl">
            Upload your plans and get a full compliance report before the city
            ever sees them. Catch violations now, not 30 days from now.
          </p>
        </BlurFade>

        <BlurFade delay={0.28} direction="up" offset={10}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={openDemo}
              className="min-w-[180px] rounded-lg bg-cyan px-6 py-3 text-base font-semibold text-white transition hover:bg-rust"
            >
              Request Demo
            </button>
          </div>
        </BlurFade>

        <div className="mx-auto mt-14 grid max-w-3xl grid-cols-3 gap-6 border-t border-blueprint pt-10">
          {[
            { value: '<60s', label: 'vs 2-4 weeks from the city' },
            { value: '12+', label: 'Code chapters checked' },
            { value: '3D', label: 'Forge + canvas review' },
          ].map((stat, index) => (
            <BlurFade key={stat.label} delay={0.36 + index * 0.08} direction="up" offset={8}>
              <div>
                <p className="font-mono text-2xl font-semibold text-cyan md:text-3xl">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm text-offwhite/50">{stat.label}</p>
              </div>
            </BlurFade>
          ))}
        </div>
      </div>
    </section>
  )
}

export { Hero, Nav }
