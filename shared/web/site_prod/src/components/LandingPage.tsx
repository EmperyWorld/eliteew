/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Landing page with Layering Transformation, fade-ins, and session status chips.
 *
 * Invariants:
 * - RU copy from src/content; motion is progressive enhancement.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md
 */

import { CloserSection } from "@/components/CloserSection";
import { CombinedLeadSection } from "@/components/CombinedLeadSection";
import { ComparisonSection } from "@/components/ComparisonSection";
import { HeroSection } from "@/components/HeroSection";
import { JobsSection } from "@/components/JobsSection";
import { ProblemSection } from "@/components/ProblemSection";
import { ProofSection } from "@/components/ProofSection";
import { QuizSection } from "@/components/QuizSection";
import { Section } from "@/components/Section";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SolutionSection } from "@/components/SolutionSection";
import { hero } from "@/content";

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-(--color-bg) text-(--color-fg)">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,242,255,0.15), transparent), radial-gradient(ellipse 60% 40% at 80% 60%, rgba(45,212,191,0.08), transparent)",
        }}
      />

      <SiteHeader />

      <Section id={hero.id}>
        <HeroSection />
      </Section>

      <Section id="problem">
        <ProblemSection />
      </Section>

      <Section id="jobs">
        <JobsSection />
      </Section>

      <Section id="solution">
        <SolutionSection />
      </Section>

      <Section id="comparison">
        <ComparisonSection />
      </Section>

      <Section id="proof">
        <ProofSection />
      </Section>

      <Section id="closer">
        <CloserSection />
      </Section>

      <Section id="quiz">
        <QuizSection />
      </Section>

      {/* Legacy CTA hashes → same combined form (preselect via hashchange) */}
      <div id="demo" className="scroll-mt-24" />
      <div id="poc" className="scroll-mt-24" />
      <div id="roi" className="scroll-mt-24" />
      <div id="tco" className="scroll-mt-24" />

      <Section id="contact">
        <CombinedLeadSection />
      </Section>

      <div id="whitepaper" className="scroll-mt-24" />

      <SiteFooter />
    </div>
  );
}
