import { DemoModalProvider } from '@/components/landing/demo-modal'
import { Hero, Nav } from '@/components/landing/hero'
import { FeaturesSection } from '@/components/landing/features'
import { StandardsMarquee } from '@/components/landing/standards-marquee'
import {
  CtaSection,
  Footer,
  WorkflowSection,
} from '@/components/landing/workflow-cta'

export function LandingPage() {
  return (
    <DemoModalProvider>
      <main className="min-h-screen bg-navy text-offwhite">
        <Nav />
        <Hero />
        <FeaturesSection />
        <StandardsMarquee />
        <WorkflowSection />
        <CtaSection />
        <Footer />
      </main>
    </DemoModalProvider>
  )
}
