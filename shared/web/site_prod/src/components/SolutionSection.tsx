/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Solution block — Layering stack + three Safe Workspace pillars + PoC CTA.
 *
 * Invariants:
 * - Copy from content/solution; shows tech, benefit, and result for each pillar.
 * - Separation language; links to #hook for One Click Transformation demo.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md §Solution
 * - /home/owned/site_doc/dialog.md block 3
 */

"use client";

import { CtaButton } from "@/components/CtaButton";
import { FadeIn } from "@/components/FadeIn";
import { SessionStatus } from "@/components/SessionStatus";
import {
  SOLUTION_LAYER_STACK,
  SOLUTION_LAYER_CAPTION,
  SOLUTION_LAYER_DEMO,
  SOLUTION_PILLAR_VISUAL,
  SOLUTION_PILLARS_META,
  SOLUTION_CTA_PATHS,
  hasVisualForPillar,
} from "@/components/solutionVisual";
import { solution } from "@/content";
import { ArrowDown, Globe, Link2, Shield, Zap } from "lucide-react";

const pillarIcon = {
  sandbox: Shield,
  "zero-agent": Globe,
  instant: Zap,
} as const;

function LayerStackDiagram() {
  // Visual order: dome (B) on top, device (A) underneath
  const layersTopFirst = [...SOLUTION_LAYER_STACK].reverse();

  return (
    <figure
      className="relative overflow-hidden rounded-2xl border border-cyan-300/25 bg-[#070a10]/80 p-4 sm:p-5"
      aria-labelledby="solution-layer-title"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(0,242,255,0.18), transparent 60%)",
        }}
      />

      <div className="relative mb-4 flex flex-wrap items-center justify-between gap-2">
        <p
          id="solution-layer-title"
          className="text-[10px] uppercase tracking-[0.16em] text-(--color-accent)"
        >
          Layering · слоистость
        </p>
        <span className="rounded-md border border-white/12 bg-black/30 px-2 py-0.5 text-[10px] text-white/45">
          B поверх A · купол, не замена ОС
        </span>
      </div>

      <div className="relative">
        {layersTopFirst.map((layer, index) => {
          const isDome = layer.id === "dome";
          return (
            <div key={layer.id} className={isDome ? "relative z-10" : "relative z-0"}>
              {index === 1 ? (
                <div
                  className="relative z-20 -my-1 flex items-center justify-center gap-2 py-2 text-[10px] uppercase tracking-[0.14em] text-white/40"
                  aria-hidden
                >
                  <span className="h-px w-8 bg-linear-to-r from-transparent to-cyan-300/40" />
                  <ArrowDown className="h-3.5 w-3.5 text-(--color-accent)/80" />
                  <span>купол покрывает хаос</span>
                  <ArrowDown className="h-3.5 w-3.5 text-(--color-accent)/80" />
                  <span className="h-px w-8 bg-linear-to-l from-transparent to-cyan-300/40" />
                </div>
              ) : null}
              <div
                className={[
                  "rounded-xl border px-4 py-3 backdrop-blur-md",
                  isDome
                    ? "border-cyan-300/40 bg-[rgba(0,242,255,0.12)] shadow-[0_0_48px_rgba(0,242,255,0.18)]"
                    : "mx-2 border-white/10 bg-black/45 sm:mx-3",
                ].join(" ")}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={[
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold",
                        isDome
                          ? "border-cyan-300/40 bg-cyan-400/15 text-(--color-accent)"
                          : "border-white/12 bg-white/5 text-white/45",
                      ].join(" ")}
                    >
                      {layer.letter}
                    </span>
                    <div className="min-w-0">
                      <p
                        className={[
                          "text-[10px] uppercase tracking-[0.16em]",
                          isDome ? "text-(--color-accent)" : "text-white/40",
                        ].join(" ")}
                      >
                        {layer.role}
                      </p>
                      <p className="mt-1 text-sm font-medium text-white sm:text-base">
                        {layer.label}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-white/55 sm:text-sm">
                        {layer.detail}
                      </p>
                    </div>
                  </div>
                  {isDome ? (
                    <SessionStatus
                      label="Secure Session Active"
                      className="shrink-0 scale-90 origin-right"
                    />
                  ) : null}
                </div>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {layer.chips.map((chip) => (
                    <li
                      key={chip}
                      className={[
                        "rounded-md border px-2 py-0.5 text-[10px]",
                        isDome
                          ? "border-cyan-300/20 bg-cyan-400/10 text-cyan-100/80"
                          : "border-white/10 bg-black/35 text-white/45",
                      ].join(" ")}
                    >
                      {chip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      <figcaption className="relative mt-4 flex flex-col gap-3 border-t border-white/8 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] leading-relaxed text-white/45">
          {SOLUTION_LAYER_CAPTION}
        </p>
        <a
          href={SOLUTION_LAYER_DEMO.href}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-(--color-accent) transition hover:border-cyan-300/45 hover:bg-cyan-400/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)"
        >
          <Link2 className="h-3.5 w-3.5" aria-hidden />
          <span>
            {SOLUTION_LAYER_DEMO.label}
            <span className="mt-0.5 block font-normal text-white/40">
              {SOLUTION_LAYER_DEMO.hint}
            </span>
          </span>
        </a>
      </figcaption>
    </figure>
  );
}

export function SolutionSection() {
  return (
    <>
      <FadeIn>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-(--color-accent)">
            {solution.eyebrow}
          </p>
          <SessionStatus label="Secure Session Active" />
        </div>
        <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight sm:text-3xl">
          {solution.title}
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/70 sm:text-lg">
          {solution.identity}
        </p>
        <ul
          className="mt-5 flex flex-wrap gap-2"
          aria-label="Инварианты Safe Workspace"
        >
          {solution.trustNotes.map((note) => (
            <li
              key={note}
              className="rounded-md border border-white/12 bg-white/4 px-2.5 py-1 text-[11px] text-white/55"
            >
              {note}
            </li>
          ))}
        </ul>
      </FadeIn>

      <FadeIn delay={0.08} className="mt-8">
        <LayerStackDiagram />
      </FadeIn>

      <FadeIn delay={0.1} className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
              {solution.pillarsEyebrow}
            </p>
            <p className="mt-1 max-w-2xl text-sm text-white/55">
              {solution.pillarsIntro}
            </p>
          </div>
          <span className="rounded-md border border-white/12 bg-black/30 px-2 py-0.5 text-[10px] text-white/45">
            {SOLUTION_PILLARS_META.flowHint}
          </span>
        </div>
        <ul className="grid gap-4 lg:grid-cols-3">
          {solution.pillars.map((p, i) => {
            const visual = hasVisualForPillar(p.id)
              ? SOLUTION_PILLAR_VISUAL[p.id]
              : null;
            const Icon =
              p.id in pillarIcon
                ? pillarIcon[p.id as keyof typeof pillarIcon]
                : Shield;
            const tone = visual?.tone ?? "lead";
            const articleClass =
              tone === "lead"
                ? "border-cyan-300/30 bg-cyan-400/8"
                : tone === "access"
                  ? "border-teal-300/25 bg-teal-400/5"
                  : "border-amber-300/20 bg-amber-400/5";
            const iconClass =
              tone === "lead"
                ? "border-cyan-300/35 bg-cyan-400/15 text-(--color-accent)"
                : tone === "access"
                  ? "border-teal-300/30 bg-teal-400/10 text-teal-100/90"
                  : "border-amber-300/30 bg-amber-400/10 text-amber-100/90";
            return (
              <li key={p.id} className="h-full">
                <FadeIn delay={0.06 * i} className="h-full">
                  <article
                    className={[
                      "flex h-full flex-col rounded-2xl border p-5 backdrop-blur-md",
                      articleClass,
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={[
                            "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                            iconClass,
                          ].join(" ")}
                        >
                          <Icon
                            className="h-5 w-5"
                            strokeWidth={1.5}
                            aria-hidden
                          />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-(--color-accent)">
                            {p.metaphor}
                          </p>
                          <h3 className="mt-1 text-base font-medium text-white">
                            {p.title}
                          </h3>
                          {visual ? (
                            <span className="mt-2 inline-flex rounded-md border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] text-white/50">
                              {visual.badge}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {visual ? (
                        <span className="shrink-0 rounded-md border border-white/12 bg-black/30 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white/45">
                          {visual.step}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 space-y-3">
                      <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                          {visual?.techLabel ?? "Как устроено"}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-white/60">
                          {p.tech}
                        </p>
                      </div>
                      <div className="rounded-xl border border-cyan-300/15 bg-cyan-400/5 px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-[0.12em] text-(--color-accent)/70">
                          {visual?.benefitLabel ?? "Зачем бизнесу"}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-white/80">
                          {p.benefit}
                        </p>
                      </div>
                    </div>

                    {visual ? (
                      <p className="mt-3 rounded-md border border-teal-300/15 bg-teal-400/5 px-2.5 py-1.5 text-[11px] text-teal-100/75">
                        {visual.layerHint}
                      </p>
                    ) : null}

                    <div className="mt-auto border-t border-white/8 pt-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">
                        {visual?.outcomeLabel ?? "Итог"}
                      </p>
                      <p className="mt-1 border-l-2 border-(--color-accent)/40 pl-2.5 text-sm leading-relaxed text-white/70">
                        {p.result}
                      </p>
                    </div>
                  </article>
                </FadeIn>
              </li>
            );
          })}
        </ul>
      </FadeIn>

      <FadeIn delay={0.12} className="mt-8">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex h-full flex-col rounded-2xl border border-cyan-300/30 bg-cyan-400/8 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-400/10 text-(--color-accent)">
                  <Zap className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                    {SOLUTION_CTA_PATHS.poc.step} · {SOLUTION_CTA_PATHS.poc.eyebrow}
                  </p>
                  <p className="mt-1 text-xs text-white/55">
                    {SOLUTION_CTA_PATHS.poc.hint}
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-md border border-white/12 bg-black/30 px-2 py-1 text-[10px] text-white/45">
                {SOLUTION_CTA_PATHS.poc.friction}
              </span>
            </div>
            <div className="mt-auto pt-4">
              <CtaButton cta={solution.cta} className="w-full" />
            </div>
          </div>

          <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/5 text-white/60">
                  <Link2 className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                    {SOLUTION_CTA_PATHS.transform.step} ·{" "}
                    {SOLUTION_CTA_PATHS.transform.eyebrow}
                  </p>
                  <p className="mt-1 text-xs text-white/55">
                    {SOLUTION_CTA_PATHS.transform.hint}
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-md border border-white/12 bg-black/30 px-2 py-1 text-[10px] text-white/45">
                {SOLUTION_CTA_PATHS.transform.friction}
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-white/45">
              {solution.visualBrief}
            </p>
            <div className="mt-auto pt-4">
              <a
                href={solution.transformHref}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-transparent px-5 py-3 text-sm font-medium text-(--color-fg) transition hover:border-(--color-accent) hover:text-(--color-accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)"
              >
                <Link2 className="h-4 w-4" aria-hidden />
                {solution.transformLinkLabel}
              </a>
            </div>
          </div>
        </div>
      </FadeIn>
    </>
  );
}
