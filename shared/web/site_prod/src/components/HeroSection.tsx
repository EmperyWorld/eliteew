/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Hero (Hook) — Shadow IT pain H1, dual CTA paths, Layering TransformationScene.
 *
 * Invariants:
 * - Copy from content/hero; motion is progressive enhancement.
 * - Dual CTA: quiz (soft) + demo (hard) — no buy-or-leave pressure.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md §Hero
 * - TransformationScene.tsx · heroVisual.ts
 */

"use client";

import { CtaButton } from "@/components/CtaButton";
import { FadeIn } from "@/components/FadeIn";
import { SessionStatus } from "@/components/SessionStatus";
import { TransformationScene } from "@/components/TransformationScene";
import {
  HERO_TRUST_SIGNALS,
  heroPathForIntent,
} from "@/components/heroVisual";
import { hero, solution } from "@/content";
import { ClipboardList, MonitorPlay } from "lucide-react";

export function HeroSection() {
  return (
    <>
      <FadeIn>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-(--color-accent)">
            {hero.eyebrow}
          </p>
          <SessionStatus className="hidden sm:inline-flex" label="Data Isolated" />
        </div>

        <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
          <span className="block text-white">{hero.h1Pain}</span>
          <span className="mt-3 block text-[0.92em] text-(--color-accent) sm:mt-4">
            {hero.h1Promise}
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
          {hero.subheadline}
        </p>

        <ul
          className="mt-5 flex flex-wrap gap-2"
          aria-label="Аудитория и инварианты Hook"
        >
          {hero.audienceChips.map((chip) => (
            <li
              key={chip}
              className="rounded-md border border-cyan-300/20 bg-cyan-400/5 px-2.5 py-1 text-[11px] text-white/60"
            >
              {chip}
            </li>
          ))}
        </ul>

        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Каналы доступа">
          {HERO_TRUST_SIGNALS.map((signal) => (
            <li
              key={signal.id}
              className="rounded-md border border-white/12 bg-white/4 px-2.5 py-1 text-[11px] text-white/55"
            >
              {signal.label}
            </li>
          ))}
        </ul>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4">
          {hero.ctas.map((cta) => {
            const path = heroPathForIntent(cta.intent);
            const Icon = cta.intent === "demo" ? MonitorPlay : ClipboardList;
            const isPrimary = cta.variant === "primary";
            return (
              <div
                key={cta.intent + cta.label}
                className={[
                  "rounded-2xl border px-4 py-4 backdrop-blur-md sm:px-5",
                  isPrimary
                    ? "border-cyan-300/30 bg-cyan-400/8"
                    : "border-white/10 bg-black/25",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={[
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                      isPrimary
                        ? "border-cyan-300/30 bg-cyan-400/10 text-(--color-accent)"
                        : "border-white/12 bg-white/5 text-white/60",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    {path ? (
                      <>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                          {path.eyebrow}
                        </p>
                        <p className="mt-1 text-xs leading-snug text-white/50">
                          {path.hint}
                        </p>
                      </>
                    ) : null}
                    <div className="mt-3">
                      <CtaButton cta={cta} className="w-full sm:w-auto" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </FadeIn>

      <FadeIn delay={0.12} className="mt-10">
        <TransformationScene
          ctaLabel={solution.transformCtaLabel}
          caption={hero.visualBrief}
        />
        <p className="mt-6 text-center text-[11px] uppercase tracking-[0.16em] text-white/35">
          <a href="#problem" className="transition hover:text-(--color-accent)">
            Дальше · слепая зона периметра ↓
          </a>
        </p>
      </FadeIn>
    </>
  );
}
