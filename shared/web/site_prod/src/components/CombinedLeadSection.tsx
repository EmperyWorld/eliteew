/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * One combined lead form for demo / PoC / ROI / TCO — multi-select → single POST bundle.
 *
 * Invariants:
 * - At least one interest required; honest error if API fails.
 * - Hash #demo|#poc|#roi|#tco preselects interest; section id=contact.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md §CTA ladder
 * - lib/leadSchema.ts (intent=bundle)
 * - content/contact.ts
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  interestFromHash,
  LEAD_BUNDLE_OPTIONS,
  summarizeBundle,
} from "@/components/leadBundle";
import {
  CONTACT_INTEREST_VISUAL,
  CONTACT_META,
  contactInterestToneClass,
} from "@/components/contactVisual";
import { SessionStatus } from "@/components/SessionStatus";
import { contactPack } from "@/content/contact";
import { privacyNotice } from "@/content/brand";
import type { LeadInterest } from "@/lib/leadSchema";
import {
  Calculator,
  Check,
  CheckCircle2,
  MonitorPlay,
  Package,
  Rocket,
  Table2,
} from "lucide-react";

function toggleInterest(
  current: LeadInterest[],
  id: LeadInterest,
): LeadInterest[] {
  return current.includes(id)
    ? current.filter((x) => x !== id)
    : [...current, id];
}

function interestIcon(id: LeadInterest) {
  switch (id) {
    case "demo":
      return MonitorPlay;
    case "poc":
      return Rocket;
    case "roi":
      return Calculator;
    case "tco_table":
      return Table2;
    default:
      return Package;
  }
}

export function CombinedLeadSection() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [companySize, setCompanySize] = useState<"1-99" | "100-1000" | "1000+">(
    "100-1000",
  );
  const [interests, setInterests] = useState<LeadInterest[]>(["poc"]);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function applyHash() {
      const fromHash = interestFromHash(window.location.hash);
      if (fromHash) {
        setInterests((prev) =>
          prev.includes(fromHash) ? prev : [...prev, fromHash],
        );
      }
    }
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const summary = useMemo(() => summarizeBundle(interests), [interests]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (interests.length < 1) {
      setStatus("error");
      setError(contactPack.emptyInterestsError);
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "bundle",
          interests,
          contact: {
            email: email.trim(),
            phone: phone.trim() || undefined,
            name: name.trim() || undefined,
            companySize,
          },
          source: "site_prod_bundle",
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        id?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.id) {
        setStatus("error");
        setError(
          data.error === "too_many_requests"
            ? "Слишком много запросов. Попробуйте через минуту."
            : "Не удалось отправить. Проверьте поля и попробуйте снова.",
        );
        return;
      }
      setStatus("ok");
    } catch {
      setStatus("error");
      setError("Сеть недоступна. Повторите отправку позже.");
    }
  }

  if (status === "ok") {
    return (
      <div className="rounded-2xl border border-teal-400/30 bg-teal-400/10 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="mt-0.5 h-5 w-5 shrink-0 text-teal-200"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-lg font-medium text-teal-50">
              {contactPack.successTitle}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-teal-100/80">
              {contactPack.successHint}
            </p>
            <p className="mt-3 text-xs text-teal-100/60">{summary.detail}</p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <a
                href="#quiz"
                className="text-(--color-accent) transition hover:brightness-110"
              >
                Экспресс-аудит →
              </a>
              <a
                href="#hook"
                className="text-white/55 transition hover:text-white/80"
              >
                Наверх
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-3xl">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <p className="text-xs uppercase tracking-[0.2em] text-(--color-accent)">
              {contactPack.eyebrow}
            </p>
            <span className="rounded-md border border-white/12 bg-black/30 px-2 py-0.5 text-[10px] text-white/45">
              {contactPack.flowHint}
            </span>
            <span className="rounded-md border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-(--color-accent)/85">
              {CONTACT_META.ladderHint}
            </span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {contactPack.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/70 sm:text-lg">
            {contactPack.intro}
          </p>
        </div>
        <SessionStatus label="Data Isolated" className="shrink-0" />
      </div>

      <ul
        className="flex flex-wrap gap-2"
        aria-label="Как устроен запрос"
      >
        {contactPack.trustNotes.map((note) => (
          <li
            key={note}
            className="rounded-md border border-white/12 bg-white/4 px-2.5 py-1 text-[11px] text-white/50"
          >
            {note}
          </li>
        ))}
      </ul>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <div className="space-y-5">
          <fieldset>
            <legend className="flex w-full flex-wrap items-center justify-between gap-2 text-sm font-medium text-white">
              <span>{contactPack.interestsLegend}</span>
              <span className="text-[11px] font-normal text-white/40">
                выбрано: {summary.count}
              </span>
            </legend>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {LEAD_BUNDLE_OPTIONS.map((opt) => {
                const on = interests.includes(opt.id);
                const Icon = interestIcon(opt.id);
                const visual = CONTACT_INTEREST_VISUAL[opt.id];
                const tones = contactInterestToneClass(visual.tone, on);
                return (
                  <li key={opt.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setInterests((prev) => toggleInterest(prev, opt.id))
                      }
                      className={[
                        "flex h-full w-full flex-col rounded-2xl border p-4 text-left transition",
                        tones.card,
                      ].join(" ")}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="flex min-w-0 items-start gap-2.5">
                          <span
                            className={[
                              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                              tones.icon,
                            ].join(" ")}
                          >
                            <Icon className="h-4 w-4" aria-hidden />
                          </span>
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                              <span
                                className={[
                                  "rounded border px-1.5 py-0.5 text-[9px] font-medium tabular-nums",
                                  tones.badge,
                                ].join(" ")}
                              >
                                {visual.step}
                              </span>
                              <span className="font-medium text-white">
                                {opt.title}
                              </span>
                            </span>
                            <span className="mt-1 block text-[10px] text-white/40">
                              {opt.deliverable}
                            </span>
                          </span>
                        </span>
                        <span
                          className={[
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                            on
                              ? "border-cyan-300/50 bg-cyan-400/20 text-(--color-accent)"
                              : "border-white/20 text-transparent",
                          ].join(" ")}
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden />
                        </span>
                      </span>
                      <span className="mt-2 pl-10.5 text-xs leading-relaxed text-white/55">
                        {opt.blurb}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          <div className="rounded-2xl border border-white/10 bg-[#070a10]/70 px-4 py-3 sm:px-5">
            <div className="flex items-start gap-2">
              <Package
                className="mt-0.5 h-4 w-4 shrink-0 text-(--color-accent)"
                aria-hidden
              />
              <div>
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">
                  {CONTACT_META.packEyebrow}
                </p>
                <p className="mt-1 text-sm font-medium text-white">{summary.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-white/50">
                  {summary.detail}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-cyan-300/20 bg-black/30 p-4 sm:p-5 lg:sticky lg:top-24">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">
                {CONTACT_META.fieldsEyebrow}
              </p>
              <p className="mt-1 text-sm font-medium text-white">
                {contactPack.fieldsLegend}
              </p>
            </div>
            <span className="rounded-md border border-white/12 bg-black/30 px-2 py-0.5 text-[10px] text-white/45">
              выбрано: {summary.count}
            </span>
          </div>
          <div className="grid gap-3">
            <label className="block text-xs text-white/55">
              Email *
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-(--color-accent)"
              />
            </label>
            <label className="block text-xs text-white/55">
              Телефон
              <input
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-(--color-accent)"
              />
            </label>
            <label className="block text-xs text-white/55">
              Имя
              <input
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-(--color-accent)"
              />
            </label>
            <label className="block text-xs text-white/55">
              Размер компании *
              <select
                required
                value={companySize}
                onChange={(e) =>
                  setCompanySize(e.target.value as "1-99" | "100-1000" | "1000+")
                }
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-(--color-accent)"
              >
                <option value="1-99">До 100</option>
                <option value="100-1000">100–1000</option>
                <option value="1000+">Более 1000</option>
              </select>
            </label>
          </div>

          <p className="text-[11px] leading-relaxed text-white/40">{privacyNotice}</p>
          {error ? (
            <p className="text-sm text-amber-200/90" role="alert">
              {error}
            </p>
          ) : null}

          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">
              {CONTACT_META.submitEyebrow}
            </p>
            <button
              type="submit"
              disabled={status === "loading" || interests.length < 1}
              className="mt-2 w-full rounded-lg bg-(--color-cta) px-5 py-2.5 text-sm font-medium text-(--color-bg) shadow-[0_0_24px_rgba(45,212,191,0.25)] disabled:opacity-60"
            >
              {status === "loading"
                ? contactPack.submitLoading
                : contactPack.submitLabel}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
