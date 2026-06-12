'use client'

import { BlurFade } from '@/components/magicui/blur-fade'
import { Marquee } from '@/components/magicui/marquee'

const STANDARDS = [
  'International Building Code (IBC)',
  'International Residential Code (IRC)',
  'ADA / A117.1',
  'NFPA 101 Life Safety',
  'California Title 24',
  'Florida Building Code',
  'Energy Code (IECC)',
  'Local amendments',
]

function StandardBadge({ label }: { label: string }) {
  return (
    <span className="mx-2 inline-flex items-center rounded-full border border-blueprint bg-surface px-4 py-2 font-mono text-sm text-offwhite/70">
      {label}
    </span>
  )
}

export function StandardsMarquee() {
  return (
    <section id="standards" className="border-y border-blueprint bg-surface py-10">
      <BlurFade inView direction="up" className="mx-auto mb-6 max-w-6xl px-6 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-cyan">
          Code coverage
        </p>
        <h2 className="mt-2 text-xl font-medium text-offwhite md:text-2xl">
          Built for the standards your jurisdiction actually enforces
        </h2>
      </BlurFade>
      <BlurFade inView delay={0.12} direction="up">
        <Marquee pauseOnHover className="[--duration:50s]">
          {STANDARDS.map((standard) => (
            <StandardBadge key={standard} label={standard} />
          ))}
        </Marquee>
      </BlurFade>
      <BlurFade inView delay={0.2} direction="up">
        <Marquee reverse pauseOnHover className="mt-4 [--duration:55s]">
          {STANDARDS.map((standard) => (
            <StandardBadge key={`${standard}-rev`} label={standard} />
          ))}
        </Marquee>
      </BlurFade>
    </section>
  )
}
