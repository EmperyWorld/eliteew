/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Closer — dual conversion paths (quiz light entry vs PoC) without buy-or-leave pressure.
 *
 * Invariants:
 * - Copy from content/closer; both CTAs remain visible.
 * - Paths show friction + outcome; no false urgency.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md §Closer
 * - /home/owned/site_doc/dialog.md block 6
 */

"use client";

import { CtaButton } from "@/components/CtaButton";
import { FadeIn } from "@/components/FadeIn";
import { SessionStatus } from "@/components/SessionStatus";
import {
  CLOSER_META,
  closerPathForIntent,
  type CloserPathTone,
} from "@/components/closerVisual";
import { closer } from "@/content";
import { ClipboardList, Rocket } from "lucide-react";

function pathToneClasses(tone: CloserPathTone, isPrimary: boolean) {
  if (tone === "soft") {
    return {
      card: isPrimary
        ? "border-teal-300/35 bg-teal-400/8"
        : "border-teal-300/20 bg-teal-400/5",
      icon: "border-teal-300/30 bg-teal-400/10 text-teal-100",
      step: "border-teal-300/30 bg-teal-400/10 text-teal-100",
      panel: "border-teal-300/15 bg-black/25",
    };
  }
  return {
    card: isPrimary
      ? "border-cyan-300/35 bg-cyan-400/8"
      : "border-cyan-300/20 bg-cyan-400/5",
    icon: "border-cyan-300/30 bg-cyan-400/10 text-(--color-accent)",
    step: "border-cyan-300/30 bg-cyan-400/10 text-(--color-accent)",
    panel: "border-cyan-300/15 bg-black/25",
  };
}

export function CloserSection() {
  return (
    <>
      <FadeIn>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-(--color-accent)">
            {closer.eyebrow}
          </p>
          <span className="rounded-md border border-white/12 bg-black/30 px-2 py-0.5 text-[10px] text-white/45">
            {closer.flowHint}
          </span>
          <span className="rounded-md border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-(--color-accent)/85">
            {CLOSER_META.ladderHint}
          </span>
          <SessionStatus label="Data Isolated" />
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          {closer.title}
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/80 sm:text-lg">
          {closer.statement}
        </p>
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Условия входа">
          {closer.trustNotes.map((note) => (
            <li
              key={note}
              className="rounded-md border border-white/12 bg-white/4 px-2.5 py-1 text-[11px] text-white/50"
            >
              {note}
            </li>
          ))}
        </ul>
      </FadeIn>

      <FadeIn delay={0.08} className="mt-8">
        <div className="relative grid gap-3 sm:grid-cols-2 sm:gap-4">
          <p
            className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-[#0b0e14] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/40 sm:block"
            aria-hidden
          >
            {closer.orLabel}
          </p>
          {closer.ctas.map((cta) => {
            const path = closerPathForIntent(cta.intent);
            const Icon = cta.intent === "poc" ? Rocket : ClipboardList;
            const isPrimary = cta.variant === "primary";
            const tones = path
              ? pathToneClasses(path.tone, isPrimary)
              : pathToneClasses("hard", isPrimary);
            return (
              <div
                key={cta.intent + cta.label}
                className={[
                  "relative flex h-full flex-col rounded-2xl border p-4 sm:p-5",
                  tones.card,
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span
                      className={[
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                        tones.icon,
                      ].join(" ")}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      {path ? (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={[
                                "rounded-md border px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                                tones.step,
                              ].join(" ")}
                            >
                              {path.step}
                            </span>
                            <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                              {path.eyebrow}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-white/55">{path.hint}</p>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {path ? (
                    <span className="shrink-0 rounded-md border border-white/12 bg-black/30 px-2 py-1 text-[10px] text-white/45">
                      {path.friction}
                    </span>
                  ) : null}
                </div>

                {path ? (
                  <div
                    className={[
                      "mt-4 space-y-2 rounded-xl border px-3 py-3",
                      tones.panel,
                    ].join(" ")}
                  >
                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">
                      Результат · {path.deliverable}
                    </p>
                    <p className="text-sm leading-relaxed text-white/75">
                      {path.outcome}
                    </p>
                  </div>
                ) : null}

                <div className="mt-auto pt-5">
                  <CtaButton cta={cta} className="w-full" />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-center text-[11px] text-white/35">
          {closer.orLabel} — {CLOSER_META.noPressure}
        </p>
      </FadeIn>
    </>
  );
}
