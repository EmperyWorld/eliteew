/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Differentiation — DLP/EDR vs EliteEW as a fast Shadow IT lever (TCO / Time-to-Value).
 *
 * Invariants:
 * - Copy from content/comparison; no public TCO numbers without evidence.
 * - EliteEW framed as lever atop existing stack, not full DLP replacement.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md §Differentiation
 * - /home/owned/site_doc/dialog.md block 4
 */

"use client";

import { CtaButton } from "@/components/CtaButton";
import { FadeIn } from "@/components/FadeIn";
import {
  COMPARISON_META,
  COMPARISON_ROW_VISUAL,
  COMPARISON_SPEED,
  hasVisualForCriterion,
} from "@/components/comparisonVisual";
import { comparison } from "@/content";
import { ArrowRight, Check, Gauge, X } from "lucide-react";

function SpeedContrast() {
  return (
    <figure
      className="relative overflow-hidden rounded-2xl border border-white/12 bg-[#070a10]/80 p-4 sm:p-5"
      aria-labelledby="comparison-speed-title"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-45"
        style={{
          background:
            "radial-gradient(ellipse 45% 50% at 15% 50%, rgba(148,163,184,0.12), transparent 55%), radial-gradient(ellipse 50% 55% at 85% 40%, rgba(0,242,255,0.14), transparent 55%)",
        }}
      />
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <div
          id="comparison-speed-title"
          className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-(--color-accent) sm:text-[11px]"
        >
          <Gauge className="h-3.5 w-3.5" aria-hidden />
          {COMPARISON_META.speedEyebrow}
        </div>
        <span className="rounded-md border border-cyan-300/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-(--color-accent)/90">
          {COMPARISON_META.contrastHint}
        </span>
      </div>
      <div className="relative mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">
              {COMPARISON_SPEED.dlp.label}
            </p>
            <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] text-white/40">
              {COMPARISON_SPEED.dlp.status}
            </span>
          </div>
          <p className="mt-1 text-xl font-semibold text-white/55 sm:text-2xl">
            {COMPARISON_SPEED.dlp.scale}
          </p>
          <p className="mt-1 text-xs text-white/40">{COMPARISON_SPEED.dlp.detail}</p>
        </div>
        <div className="hidden justify-center sm:flex" aria-hidden>
          <ArrowRight className="h-5 w-5 text-(--color-accent)/70" />
        </div>
        <div className="rounded-xl border border-cyan-300/35 bg-cyan-400/10 px-4 py-3 shadow-[0_0_32px_rgba(0,242,255,0.12)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-(--color-accent)">
              {COMPARISON_SPEED.elite.label}
            </p>
            <span className="rounded border border-cyan-300/30 bg-cyan-400/15 px-1.5 py-0.5 text-[9px] text-(--color-accent)/90">
              {COMPARISON_SPEED.elite.status}
            </span>
          </div>
          <p className="mt-1 text-xl font-semibold text-white sm:text-2xl">
            {COMPARISON_SPEED.elite.scale}
          </p>
          <p className="mt-1 text-xs text-white/55">{COMPARISON_SPEED.elite.detail}</p>
        </div>
      </div>
      <figcaption className="relative mt-4 border-t border-white/8 pt-3 text-center text-[11px] text-white/45">
        {COMPARISON_META.caption}
      </figcaption>
    </figure>
  );
}

export function ComparisonSection() {
  return (
    <>
      <FadeIn>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-(--color-accent)">
            {comparison.eyebrow}
          </p>
          <span className="rounded-md border border-white/12 bg-black/30 px-2 py-0.5 text-[10px] text-white/45">
            {COMPARISON_META.contrastHint}
          </span>
        </div>
        <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight sm:text-3xl">
          {comparison.title}
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/70 sm:text-lg">
          {comparison.intro}
        </p>
        <ul
          className="mt-5 flex flex-wrap gap-2"
          aria-label="Инварианты Differentiation"
        >
          {comparison.audienceChips.map((chip) => (
            <li
              key={chip}
              className="rounded-md border border-white/12 bg-white/4 px-2.5 py-1 text-[11px] text-white/55"
            >
              {chip}
            </li>
          ))}
        </ul>
      </FadeIn>

      <FadeIn delay={0.08} className="mt-8">
        <SpeedContrast />
      </FadeIn>

      <FadeIn delay={0.1} className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
              {comparison.rowsEyebrow}
            </p>
            <p className="mt-1 max-w-2xl text-sm text-white/55">
              {comparison.rowsIntro}
            </p>
          </div>
          <span className="rounded-md border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-(--color-accent)/85">
            Lead · {COMPARISON_META.leadCriterion}
          </span>
        </div>
        <ul className="space-y-3">
          {comparison.rows.map((row, i) => {
            const visual = hasVisualForCriterion(row.criterion)
              ? COMPARISON_ROW_VISUAL[row.criterion]
              : null;
            const isLead = row.criterion === COMPARISON_META.leadCriterion;
            return (
              <li key={row.criterion}>
                <FadeIn delay={0.04 * i}>
                  <article
                    className={[
                      "overflow-hidden rounded-2xl border",
                      isLead
                        ? "border-cyan-300/30 bg-cyan-400/5"
                        : "border-white/10 bg-black/25",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-2.5 sm:px-5">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 className="text-sm font-medium text-white">
                          {row.criterion}
                        </h3>
                        {isLead ? (
                          <span className="rounded-md border border-cyan-300/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-(--color-accent)">
                            главный рычаг
                          </span>
                        ) : null}
                      </div>
                      <span className="shrink-0 rounded-md border border-white/12 bg-black/30 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white/45">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="grid md:grid-cols-2">
                      <div className="border-b border-white/8 bg-black/20 px-4 py-4 md:border-r md:border-b-0 md:border-white/8 sm:px-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-md border border-rose-300/20 bg-rose-400/5 px-2 py-0.5 text-[10px] text-rose-100/60">
                            <X className="h-3 w-3" aria-hidden />
                            {comparison.columns.left}
                          </span>
                          {visual ? (
                            <span className="text-[10px] text-white/35">
                              {visual.dlpTag}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2.5 text-sm leading-relaxed text-white/50">
                          {row.left}
                        </p>
                      </div>
                      <div className="bg-cyan-400/6 px-4 py-4 sm:px-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-md border border-cyan-300/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-(--color-accent)">
                            <Check className="h-3 w-3" aria-hidden />
                            {comparison.columns.right}
                          </span>
                          {visual ? (
                            <span className="text-[10px] text-teal-100/70">
                              {visual.eliteTag}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2.5 text-sm leading-relaxed text-white/85">
                          {row.right}
                        </p>
                      </div>
                    </div>
                  </article>
                </FadeIn>
              </li>
            );
          })}
        </ul>
      </FadeIn>

      <table className="sr-only">
        <caption>{comparison.title}</caption>
        <thead>
          <tr>
            <th>Критерий</th>
            <th>{comparison.columns.left}</th>
            <th>{comparison.columns.right}</th>
          </tr>
        </thead>
        <tbody>
          {comparison.rows.map((row) => (
            <tr key={`sr-${row.criterion}`}>
              <th scope="row">{row.criterion}</th>
              <td>{row.left}</td>
              <td>{row.right}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <FadeIn delay={0.12} className="mt-8">
        <div className="rounded-2xl border border-(--color-accent)/25 bg-[rgba(0,242,255,0.06)] px-4 py-4 sm:px-5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-(--color-accent)/80">
            {comparison.killerLabel}
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-white/90 sm:text-base">
            {comparison.killerArgument}
          </p>
          <p className="mt-3 border-t border-white/8 pt-3 text-xs leading-relaxed text-white/45">
            {comparison.tcoNote}
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.14} className="mt-8">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
              {COMPARISON_META.ctaEyebrow}
            </p>
            <p className="mt-1 text-sm text-white/55">{COMPARISON_META.ctaHint}</p>
          </div>
          <div className="mt-4 sm:mt-0 sm:shrink-0">
            <CtaButton cta={comparison.cta} className="w-full sm:w-auto" />
          </div>
        </div>
      </FadeIn>
    </>
  );
}
