/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Problem block UI — Visualizing the Leak, perimeter blind spot, business risks.
 *
 * Invariants:
 * - Copy from content/problem; visual labels from problemVisual (no fluff).
 * - Metaphor: locked door (VPN/FW) vs open windows (Shadow IT channels).
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md §Problem
 * - /home/owned/site_doc/dialog.md block 2
 */

"use client";

import { FadeIn } from "@/components/FadeIn";
import { CtaButton } from "@/components/CtaButton";
import {
  PROBLEM_GAP_VISUAL,
  PROBLEM_PERIMETER_META,
  PROBLEM_SCENARIO_VISUAL,
  hasVisualForGap,
  hasVisualForScenario,
} from "@/components/problemVisual";
import { problem } from "@/content";
import {
  AlertTriangle,
  AppWindow,
  ArrowRight,
  Cloud,
  Copy,
  DoorClosed,
  MessageCircle,
  ShieldOff,
} from "lucide-react";

function LeakPath({
  from,
  via,
  to,
}: {
  from: string;
  via: string;
  to: string;
}) {
  return (
    <div
      className="mt-4 flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px]"
      aria-hidden
    >
      <span className="rounded-md border border-white/12 bg-black/35 px-2 py-1 text-white/70">
        {from}
      </span>
      <span className="text-white/30">→</span>
      <span className="rounded-md border border-amber-300/25 bg-amber-400/10 px-2 py-1 text-amber-100/85">
        {via}
      </span>
      <span className="text-white/30">→</span>
      <span className="rounded-md border border-rose-300/25 bg-rose-400/10 px-2 py-1 text-rose-100/80">
        {to}
      </span>
    </div>
  );
}

function PerimeterBlindSpot() {
  const meta = PROBLEM_PERIMETER_META;
  return (
    <figure
      className="relative overflow-hidden rounded-2xl border border-white/12 bg-[#070a10]/80 p-4 sm:p-5"
      aria-labelledby="problem-perimeter-title"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 20% 30%, rgba(45,212,191,0.08), transparent 60%), radial-gradient(ellipse 45% 50% at 80% 70%, rgba(251,113,133,0.1), transparent 55%)",
        }}
      />

      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <p
          id="problem-perimeter-title"
          className="text-[10px] uppercase tracking-[0.16em] text-(--color-accent) sm:text-[11px]"
        >
          {meta.eyebrow}
        </p>
        <span className="rounded-md border border-rose-300/20 bg-rose-400/10 px-2 py-0.5 text-[10px] text-rose-100/75">
          {meta.contrastHint}
        </span>
      </div>

      <div className="relative mt-4 grid gap-3 lg:grid-cols-[1fr_auto_1.15fr] lg:items-stretch lg:gap-4">
        <div className="rounded-xl border border-teal-300/20 bg-teal-400/5 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-teal-300/25 bg-teal-400/10 text-teal-200/90">
                <DoorClosed className="h-3.5 w-3.5" aria-hidden />
              </span>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-teal-200/90">
                {meta.door.label}
              </p>
            </div>
            <span className="text-[10px] tabular-nums text-white/35">01</span>
          </div>
          <p className="mt-3 text-sm font-medium text-white">{meta.door.title}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-white/55">
            {meta.door.body}
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-teal-300/15 bg-black/30 px-3 py-2 text-[11px] text-teal-100/75">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-300" />
            {meta.door.status}
          </div>
        </div>

        <div
          className="hidden items-center justify-center lg:flex"
          aria-hidden
        >
          <div className="flex flex-col items-center gap-1 text-(--color-accent)/55">
            <ArrowRight className="h-4 w-4" />
            <span className="text-[9px] uppercase tracking-[0.14em]">но</span>
          </div>
        </div>

        <div className="rounded-xl border border-rose-300/25 bg-rose-400/8 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-300/30 bg-rose-400/15 text-rose-200/90">
                <AppWindow className="h-3.5 w-3.5" aria-hidden />
              </span>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-rose-200/90">
                {meta.windows.label}
              </p>
            </div>
            <span className="text-[10px] tabular-nums text-white/35">02</span>
          </div>
          <p className="mt-3 text-sm font-medium text-white">{meta.windows.title}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-white/55">
            {meta.windows.body}
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-3">
            {meta.windows.channels.map((w) => (
              <li
                key={w.label}
                className="rounded-lg border border-rose-300/20 bg-black/35 px-2.5 py-2"
              >
                <p className="text-[11px] font-medium text-rose-100/90">{w.label}</p>
                <p className="mt-0.5 text-[10px] text-white/40">
                  {w.hint} → наружу
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-300/20 bg-black/30 px-3 py-2 text-[11px] text-rose-100/75">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-rose-300" />
            {meta.windows.status}
          </div>
        </div>
      </div>

      <figcaption className="relative mt-4 border-t border-white/8 pt-3 text-center text-[11px] text-white/45 sm:text-xs">
        {meta.caption}
      </figcaption>
    </figure>
  );
}

const scenarioIcon = {
  messenger: MessageCircle,
  cloud: Cloud,
  copypaste: Copy,
} as const;

export function ProblemSection() {
  return (
    <>
      <FadeIn>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-(--color-accent)">
            {problem.eyebrow}
          </p>
          <span className="rounded-md border border-rose-300/20 bg-rose-400/10 px-2 py-0.5 text-[10px] text-rose-100/75">
            {PROBLEM_PERIMETER_META.contrastHint}
          </span>
        </div>
        <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight sm:text-3xl">
          {problem.title}
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/70 sm:text-lg">
          {problem.intro}
        </p>
        <ul
          className="mt-5 flex flex-wrap gap-2"
          aria-label="Каналы Shadow IT"
        >
          {problem.audienceChips.map((chip) => (
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
        <PerimeterBlindSpot />
      </FadeIn>

      <FadeIn delay={0.1} className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
              {problem.scenariosEyebrow}
            </p>
            <p className="mt-1 max-w-2xl text-sm text-white/55">
              {problem.scenariosIntro}
            </p>
          </div>
          <span className="rounded-md border border-rose-300/20 bg-rose-400/10 px-2 py-0.5 text-[10px] text-rose-100/70">
            {PROBLEM_PERIMETER_META.windows.title}
          </span>
        </div>
        <ul className="grid gap-4 lg:grid-cols-3">
          {problem.scenarios.map((s, i) => {
            const visual = hasVisualForScenario(s.id)
              ? PROBLEM_SCENARIO_VISUAL[s.id]
              : null;
            const Icon =
              s.id in scenarioIcon
                ? scenarioIcon[s.id as keyof typeof scenarioIcon]
                : AlertTriangle;
            return (
              <li key={s.id} className="h-full">
                <FadeIn delay={0.05 * i} className="h-full">
                  <article className="flex h-full flex-col rounded-2xl border border-rose-300/20 bg-rose-400/5 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-300/25 bg-rose-400/15 text-rose-100/90">
                          <Icon
                            className="h-4 w-4"
                            strokeWidth={1.5}
                            aria-hidden
                          />
                        </span>
                        <div className="min-w-0">
                          {visual ? (
                            <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                              {visual.eyebrow}
                            </p>
                          ) : null}
                          <h3 className="mt-0.5 font-medium text-white">
                            {s.title}
                          </h3>
                          {visual ? (
                            <span className="mt-1.5 inline-flex rounded-md border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] text-white/45">
                              {visual.badge}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-md border border-white/12 bg-black/30 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white/45">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-white/65">
                      {s.body}
                    </p>
                    {visual ? (
                      <div className="mt-4 rounded-xl border border-rose-300/15 bg-black/30 px-3 py-2.5">
                        <LeakPath
                          from={visual.leakFrom}
                          via={visual.leakVia}
                          to={visual.leakTo}
                        />
                        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-amber-100/70">
                          <ShieldOff className="h-3.5 w-3.5" aria-hidden />
                          {visual.signal}
                        </p>
                      </div>
                    ) : null}
                  </article>
                </FadeIn>
              </li>
            );
          })}
        </ul>
      </FadeIn>

      <FadeIn delay={0.12} className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
              {problem.gapsEyebrow}
            </p>
            <p className="mt-1 max-w-2xl text-sm text-white/55">
              {problem.gapsIntro}
            </p>
          </div>
          <span className="rounded-md border border-white/12 bg-black/30 px-2 py-0.5 text-[10px] text-white/45">
            {PROBLEM_PERIMETER_META.contrastHint}
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {problem.gaps.map((g) => {
            const visual = hasVisualForGap(g.id)
              ? PROBLEM_GAP_VISUAL[g.id]
              : null;
            const isDoor = visual?.tone === "door";
            return (
              <article
                key={g.id}
                className={[
                  "h-full rounded-2xl border p-4 sm:p-5",
                  isDoor
                    ? "border-teal-300/20 bg-teal-400/5"
                    : "border-amber-300/20 bg-amber-400/5",
                ].join(" ")}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium text-white">{g.title}</h3>
                  {visual ? (
                    <span
                      className={[
                        "rounded-md border px-2.5 py-0.5 text-[10px]",
                        isDoor
                          ? "border-teal-300/25 bg-teal-400/10 text-teal-100/75"
                          : "border-amber-300/25 bg-amber-400/10 text-amber-100/75",
                      ].join(" ")}
                    >
                      {visual.verdict}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  {g.body}
                </p>
                {visual ? (
                  <p className="mt-4 border-t border-white/8 pt-3 text-xs leading-relaxed text-rose-100/70">
                    Слепая зона: {visual.blindSpot}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </FadeIn>

      <FadeIn delay={0.14} className="mt-8">
        <div className="rounded-2xl border border-(--color-accent)/25 bg-[rgba(0,242,255,0.06)] px-4 py-4 sm:px-5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-(--color-accent)/80">
            {problem.messageLabel}
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-white/90 sm:text-base">
            {problem.message}
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.16} className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
            {problem.risksEyebrow}
          </p>
          <span className="text-[10px] text-white/35">3 бизнес-риска</span>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {problem.risks.map((r, i) => (
            <li key={r.id}>
              <FadeIn delay={0.04 * i} className="h-full">
                <article className="flex h-full flex-col rounded-xl border border-amber-300/20 bg-amber-400/5 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle
                        className="h-4 w-4 shrink-0 text-amber-200/80"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                      <h3 className="text-sm font-medium text-white">{r.title}</h3>
                    </div>
                    <span className="shrink-0 rounded-md border border-white/12 bg-black/30 px-1.5 py-0.5 text-[10px] tabular-nums text-white/40">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">
                    {r.body}
                  </p>
                </article>
              </FadeIn>
            </li>
          ))}
        </ul>
      </FadeIn>

      <FadeIn delay={0.18} className="mt-8">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
              Следующий шаг · ROI
            </p>
            <p className="mt-1 text-sm text-white/55">
              Оценка стоимости утечки → комбинированный контактный пакет
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:shrink-0">
            <CtaButton cta={problem.cta} className="w-full sm:w-auto" />
          </div>
        </div>
      </FadeIn>
    </>
  );
}
