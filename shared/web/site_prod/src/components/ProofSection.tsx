/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Proof section — Fact vs Hypothesis, expert kit placeholders, Objection FAQ.
 *
 * Invariants:
 * - Copy from content/proof; analog/latency stay Hypothesis, never absolute Fact.
 * - No “100% secure” claims in UI chrome.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md §Proof
 * - /home/owned/site_doc/dialog.md block 5
 */

"use client";

import { useState } from "react";
import { FadeIn } from "@/components/FadeIn";
import { SessionStatus } from "@/components/SessionStatus";
import {
  faqClaimLabel,
  hasVisualForFact,
  hasVisualForHypothesis,
  PROOF_FACT_VISUAL,
  PROOF_HYPOTHESIS_VISUAL,
} from "@/components/proofVisual";
import { proof } from "@/content";
import {
  BadgeCheck,
  ChevronDown,
  CircleHelp,
  FileText,
  GitBranch,
  ShieldQuestion,
} from "lucide-react";

function AirGapSketch() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/12 bg-[#070a10]/80 p-4 sm:p-5"
      role="img"
      aria-label="Схема архитектурного разрыва: рабочая сессия отделена от личного кэша ОС"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-45"
        style={{
          background:
            "radial-gradient(ellipse 50% 45% at 25% 40%, rgba(0,242,255,0.12), transparent 55%), radial-gradient(ellipse 45% 50% at 75% 60%, rgba(148,163,184,0.1), transparent 55%)",
        }}
      />
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-white/40">
          <GitBranch className="h-3.5 w-3.5 text-(--color-accent)" aria-hidden />
          Архитектурный разрыв · Air Gap (метафора)
        </div>
        <span className="rounded-md border border-teal-300/25 bg-teal-400/10 px-2 py-0.5 text-[10px] text-teal-100/80">
          Fact · архитектура
        </span>
      </div>
      <div className="relative mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
        <div className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-(--color-accent)">
            A · Рабочая сессия
          </p>
          <p className="mt-1 text-sm font-medium text-white">EmpiierOS</p>
          <p className="mt-1 text-xs text-white/55">
            Корп. приложения · политики · рабочий контур сессии
          </p>
        </div>
        <div className="flex items-center justify-center px-1" aria-hidden>
          <div className="flex flex-col items-center gap-1">
            <span className="h-8 w-px bg-linear-to-b from-transparent via-rose-300/50 to-transparent sm:h-12" />
            <span className="rounded-md border border-rose-300/30 bg-rose-400/10 px-2 py-0.5 text-[9px] text-rose-100/80">
              разрыв
            </span>
            <span className="h-8 w-px bg-linear-to-b from-transparent via-rose-300/50 to-transparent sm:h-12" />
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">
            B · Личная ОС
          </p>
          <p className="mt-1 text-sm font-medium text-white/70">BYOD устройство</p>
          <p className="mt-1 text-xs text-white/45">
            Личный диск · мессенджеры · галерея · локальный кэш браузера
          </p>
        </div>
      </div>
      <p className="relative mt-4 border-t border-white/8 pt-3 text-center text-[11px] text-white/45">
        {proof.airGapCaption}
      </p>
    </div>
  );
}

function ObjectionFaq() {
  const [openId, setOpenId] = useState<string | null>(proof.faq[0]?.id ?? null);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
              Objection Map
            </p>
            <SessionStatus label="Data Isolated" className="hidden sm:inline-flex" />
          </div>
          <h3 className="mt-1 text-lg font-medium text-white">FAQ</h3>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-white/45">
            {proof.faqIntro}
          </p>
        </div>
        <p className="text-xs text-white/40">Ответ + указатель на Fact / Hypothesis</p>
      </div>

      <div className="mt-4 space-y-3">
        {proof.faq.map((item) => {
          const open = openId === item.id;
          const claim = faqClaimLabel(item.claimKind);
          return (
            <div
              key={item.id}
              className={[
                "rounded-2xl border p-4 transition",
                open
                  ? "border-cyan-400/25 bg-black/35"
                  : "border-white/10 bg-black/25",
              ].join(" ")}
            >
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`faq-panel-${item.id}`}
                id={`faq-trigger-${item.id}`}
                onClick={() => setOpenId(open ? null : item.id)}
                className="flex w-full items-start gap-3 text-left"
              >
                <CircleHelp
                  className="mt-0.5 h-4 w-4 shrink-0 text-(--color-accent)/80"
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                      {item.tag}
                    </span>
                    <span
                      className={[
                        "rounded-md border px-1.5 py-0.5 text-[10px]",
                        item.claimKind === "fact"
                          ? "border-teal-300/25 bg-teal-400/10 text-teal-100/80"
                          : "border-amber-300/25 bg-amber-400/10 text-amber-100/80",
                      ].join(" ")}
                    >
                      {claim}
                    </span>
                  </span>
                  <span className="font-medium text-white">{item.q}</span>
                </span>
                <ChevronDown
                  className={[
                    "mt-1 h-4 w-4 shrink-0 text-white/40 transition",
                    open ? "rotate-180 text-(--color-accent)/80" : "",
                  ].join(" ")}
                  aria-hidden
                />
              </button>

              {open ? (
                <div
                  id={`faq-panel-${item.id}`}
                  role="region"
                  aria-labelledby={`faq-trigger-${item.id}`}
                  className="mt-3 border-t border-white/8 pt-3 pl-7"
                >
                  <p className="text-sm leading-relaxed text-white/70">{item.a}</p>
                  <p className="mt-3 text-xs text-white/40">
                    <span className="text-white/50">Proof:</span>{" "}
                    <a
                      href={item.proofHref}
                      className="text-(--color-accent)/90 underline-offset-2 hover:underline"
                    >
                      {item.proof}
                    </a>
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProofSection() {
  return (
    <>
      <FadeIn>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-(--color-accent)">
            {proof.eyebrow}
          </p>
          <SessionStatus label="Data Isolated" className="hidden sm:inline-flex" />
        </div>
        <h2 className="mt-3 max-w-4xl text-2xl font-semibold sm:text-3xl">
          {proof.title}
        </h2>
        <p className="mt-4 max-w-3xl text-white/70">{proof.intro}</p>
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Классы утверждений">
          <li className="rounded-md border border-teal-300/25 bg-teal-400/10 px-2.5 py-1 text-[11px] text-teal-100/85">
            Fact · Доказано
          </li>
          <li className="rounded-md border border-amber-300/25 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-100/85">
            Hypothesis · Проверяем на PoC
          </li>
        </ul>
      </FadeIn>

      <FadeIn delay={0.08} className="mt-6">
        <AirGapSketch />
      </FadeIn>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <FadeIn delay={0.06}>
          <div className="h-full rounded-2xl border border-teal-300/25 bg-teal-400/5 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-teal-200" aria-hidden />
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-200">
                Fact
              </h3>
            </div>
            <p className="mt-2 text-xs text-white/45">{proof.factColumnHint}</p>
            <ul className="mt-4 space-y-2.5">
              {proof.facts.map((f, index) => {
                const visual = hasVisualForFact(f.id)
                  ? PROOF_FACT_VISUAL[f.id]
                  : null;
                return (
                  <li
                    key={f.id}
                    className="rounded-xl border border-white/10 bg-black/30 p-3.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-white/35">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="text-sm font-medium text-white">{f.title}</span>
                      {visual ? (
                        <>
                          <span className="rounded-md border border-teal-300/25 bg-teal-400/10 px-2 py-0.5 text-[10px] text-teal-100/80">
                            {visual.claimClass}
                          </span>
                          <span className="text-[10px] text-white/35">{visual.badge}</span>
                        </>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-white/65">{f.body}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="h-full rounded-2xl border border-amber-300/25 bg-amber-400/5 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <ShieldQuestion className="h-4 w-4 text-amber-200/90" aria-hidden />
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-200/90">
                Hypothesis (PoC)
              </h3>
            </div>
            <p className="mt-2 text-xs text-white/45">{proof.hypothesisColumnHint}</p>
            <ul className="mt-4 space-y-2.5">
              {proof.hypotheses.map((h, index) => {
                const visual = hasVisualForHypothesis(h.id)
                  ? PROOF_HYPOTHESIS_VISUAL[h.id]
                  : null;
                return (
                  <li
                    key={h.id}
                    className="rounded-xl border border-white/10 bg-black/30 p-3.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-white/35">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="text-sm font-medium text-white">{h.title}</span>
                      {visual ? (
                        <>
                          <span className="rounded-md border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-100/80">
                            {visual.claimClass}
                          </span>
                          <span className="text-[10px] text-white/35">{visual.badge}</span>
                        </>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-white/65">{h.body}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </FadeIn>
      </div>

      <FadeIn delay={0.12} className="mt-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/5 text-white/60">
              <FileText className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">
                {proof.expertKit.whitepaperLabel}
              </p>
              <p className="mt-1 text-xs text-white/45">
                {proof.expertKit.whitepaperStatus}
              </p>
              <a
                href={proof.expertKit.whitepaperHref}
                className="mt-2 inline-block text-[11px] text-white/40 underline-offset-2 hover:text-white/60 hover:underline"
              >
                Якорь #whitepaper
              </a>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/5 text-white/60">
              <GitBranch className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium text-white">
                {proof.expertKit.diagramLabel}
              </p>
              <p className="mt-1 text-xs text-white/45">
                {proof.expertKit.diagramHint}
              </p>
            </div>
          </div>
          <a
            href={proof.expertKit.contactCtaHref}
            className="flex items-start gap-3 rounded-2xl border border-cyan-300/25 bg-cyan-400/8 p-4 transition hover:border-cyan-300/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent) sm:col-span-2 lg:col-span-1"
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-400/10 text-(--color-accent)">
              <BadgeCheck className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium text-white">
                {proof.expertKit.contactCtaLabel}
              </p>
              <p className="mt-1 text-xs text-white/55">
                Demo / PoC / материалы — один контакт в #contact
              </p>
            </div>
          </a>
        </div>
      </FadeIn>

      <FadeIn delay={0.14} className="mt-8">
        <ObjectionFaq />
      </FadeIn>
    </>
  );
}
