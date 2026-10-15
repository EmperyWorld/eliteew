/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Quiz section shell — express Shadow IT audit framing around RiskQuiz.
 *
 * Invariants:
 * - Not a legal audit; qualitative risk profile only.
 *
 * Related:
 * - RiskQuiz.tsx
 * - documentation/product/SITE-PROD-LANDING.md §CTA ladder
 */

"use client";

import { FadeIn } from "@/components/FadeIn";
import { RiskQuiz } from "@/components/RiskQuiz";
import { SessionStatus } from "@/components/SessionStatus";
import { QUIZ_META } from "@/components/quizVisual";
import { quiz } from "@/content";

export function QuizSection() {
  return (
    <>
      <FadeIn>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-(--color-accent)">
            {quiz.eyebrow}
          </p>
          <span className="rounded-md border border-white/12 bg-black/30 px-2 py-0.5 text-[10px] text-white/45">
            {quiz.flowHint}
          </span>
          <span className="rounded-md border border-teal-300/20 bg-teal-400/10 px-2 py-0.5 text-[10px] text-teal-100/85">
            {QUIZ_META.ladderHint}
          </span>
          <SessionStatus label="Data Isolated" className="hidden sm:inline-flex" />
        </div>
        <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">
          {quiz.title}
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/70 sm:text-lg">
          {quiz.description}
        </p>
        <ul
          className="mt-5 flex flex-wrap gap-2"
          aria-label="Инварианты экспресс-аудита"
        >
          {quiz.chips.map((chip) => (
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
        <div className="overflow-hidden rounded-2xl border border-teal-300/20 bg-black/30">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-4 py-2.5 sm:px-5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
              {QUIZ_META.shellEyebrow}
            </p>
            <a
              href="#contact"
              className="text-[11px] text-(--color-accent)/80 transition hover:text-(--color-accent)"
            >
              Сразу к пакету →
            </a>
          </div>
          <div className="p-4 sm:p-6">
            <RiskQuiz />
          </div>
        </div>
      </FadeIn>
    </>
  );
}
