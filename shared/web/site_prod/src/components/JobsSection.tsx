/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * JTBD section — buying committee + role portraits (CISO / CEO / employee).
 *
 * Invariants:
 * - Copy from content/jobs; employee language stays separation, not surveillance.
 * - Visual keys cover every jobs.roles id.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md §JTBD
 * - /home/owned/site_doc task.md Part 2
 */

"use client";

import { FadeIn } from "@/components/FadeIn";
import {
  JOB_COMMITTEE_META,
  JOB_COMMITTEE_ORDER,
  JOB_ROLE_VISUAL,
  hasVisualForJobRole,
} from "@/components/jobsVisual";
import { jobs } from "@/content";
import { ArrowRight, Briefcase, Shield, UserRound } from "lucide-react";

const roleIcon = {
  ciso: Shield,
  ceo: Briefcase,
  employee: UserRound,
} as const;

function BuyingCommitteeStrip() {
  return (
    <figure
      className="relative overflow-hidden rounded-2xl border border-white/12 bg-[#070a10]/75 p-4 sm:p-5"
      aria-labelledby="jobs-committee-title"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 15% 40%, rgba(0,242,255,0.1), transparent 55%), radial-gradient(ellipse 50% 45% at 85% 60%, rgba(45,212,191,0.08), transparent 50%)",
        }}
      />
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <p
          id="jobs-committee-title"
          className="text-[10px] uppercase tracking-[0.16em] text-(--color-accent) sm:text-[11px]"
        >
          {JOB_COMMITTEE_META.eyebrow}
        </p>
        <span className="rounded-md border border-white/12 bg-black/30 px-2 py-0.5 text-[10px] text-white/45">
          {JOB_COMMITTEE_META.flowHint}
        </span>
      </div>

      <ol className="relative mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-stretch">
        {JOB_COMMITTEE_ORDER.map((id, index) => {
          const role = jobs.roles.find((r) => r.id === id);
          const visual = JOB_ROLE_VISUAL[id];
          const Icon = roleIcon[id];
          const isLead = id === "ciso";
          if (!role) return null;
          return (
            <li key={id} className="contents">
              <div
                className={[
                  "rounded-xl border px-3 py-3 backdrop-blur-sm",
                  isLead
                    ? "border-cyan-300/30 bg-cyan-400/10"
                    : "border-white/10 bg-black/35",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={[
                      "flex h-7 w-7 items-center justify-center rounded-md border",
                      isLead
                        ? "border-cyan-300/35 bg-cyan-400/15 text-(--color-accent)"
                        : "border-(--color-accent)/30 text-(--color-accent)",
                    ].join(" ")}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="text-[10px] text-white/40">
                    {String(index + 1).padStart(2, "0")} · {visual.committee}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-white">{role.role}</p>
                <p className="mt-1 text-[11px] leading-snug text-white/50">
                  {visual.stake}
                </p>
                <span className="mt-2 inline-flex rounded-md border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] text-(--color-accent)/90">
                  {visual.focus}
                </span>
              </div>
              {index < JOB_COMMITTEE_ORDER.length - 1 ? (
                <div
                  className="hidden items-center justify-center sm:flex"
                  aria-hidden
                >
                  <ArrowRight className="h-4 w-4 text-(--color-accent)/60" />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <figcaption className="relative mt-4 border-t border-white/8 pt-3 text-center text-[11px] text-white/45">
        {JOB_COMMITTEE_META.caption}
      </figcaption>
    </figure>
  );
}

export function JobsSection() {
  return (
    <>
      <FadeIn>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs uppercase tracking-[0.2em] text-(--color-accent)">
            {jobs.eyebrow}
          </p>
          <span className="rounded-md border border-white/12 bg-black/30 px-2 py-0.5 text-[10px] text-white/45">
            {JOB_COMMITTEE_META.flowHint}
          </span>
        </div>
        <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight sm:text-3xl">
          {jobs.title}
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/70 sm:text-lg">
          {jobs.intro}
        </p>
        <ul
          className="mt-5 flex flex-wrap gap-2"
          aria-label="Аудитория и инварианты JTBD"
        >
          {jobs.audienceChips.map((chip) => (
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
        <BuyingCommitteeStrip />
      </FadeIn>

      <FadeIn delay={0.1} className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
              {jobs.rolesEyebrow}
            </p>
            <p className="mt-1 max-w-2xl text-sm text-white/55">{jobs.rolesIntro}</p>
          </div>
          <span className="rounded-md border border-white/12 bg-black/30 px-2 py-0.5 text-[10px] text-white/45">
            {JOB_COMMITTEE_META.flowHint}
          </span>
        </div>
        <ul className="grid gap-4 lg:grid-cols-3">
          {jobs.roles.map((role, i) => {
            const Icon = roleIcon[role.id];
            const visual = hasVisualForJobRole(role.id)
              ? JOB_ROLE_VISUAL[role.id]
              : null;
            const tone = visual?.tone ?? "lead";
            const articleClass =
              tone === "lead"
                ? "border-cyan-300/30 bg-cyan-400/8"
                : tone === "buyer"
                  ? "border-amber-300/20 bg-amber-400/5"
                  : "border-teal-300/25 bg-teal-400/5";
            const iconClass =
              tone === "lead"
                ? "border-cyan-300/35 bg-cyan-400/15 text-(--color-accent)"
                : tone === "buyer"
                  ? "border-amber-300/30 bg-amber-400/10 text-amber-100/90"
                  : "border-teal-300/30 bg-teal-400/10 text-teal-100/90";
            return (
              <li key={role.id} className="h-full">
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
                          <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-medium text-white">{role.role}</h3>
                          <p className="mt-0.5 text-xs text-white/45">{role.audience}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {visual ? (
                              <>
                                <span className="inline-flex rounded-md border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] text-(--color-accent)/90">
                                  {visual.focus}
                                </span>
                                <span className="inline-flex rounded-md border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-white/45">
                                  {visual.badge}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      {visual ? (
                        <span className="shrink-0 rounded-md border border-white/12 bg-black/30 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white/45">
                          {visual.step}
                        </span>
                      ) : null}
                    </div>

                    {visual ? (
                      <p className="mt-3 text-[11px] leading-snug text-white/45">
                        {visual.stake}
                      </p>
                    ) : null}

                    <div className="mt-4 rounded-xl border border-rose-300/15 bg-rose-400/5 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-rose-100/55">
                        {visual?.painLabel ?? "Боль"}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-white/70">
                        {role.pain}
                      </p>
                    </div>

                    <div className="mt-4 rounded-xl border border-white/10 bg-black/25 px-3 py-3">
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-(--color-accent)">
                        {visual?.hireVerb ?? "Jobs to be Done"}
                      </p>
                      <ol className="mt-2.5 space-y-2.5">
                        {role.jobs.map((job, jobIndex) => (
                          <li
                            key={job}
                            className="flex gap-2.5 text-sm leading-relaxed text-white/75"
                          >
                            <span
                              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/12 bg-black/40 text-[10px] text-white/45"
                              aria-hidden
                            >
                              {jobIndex + 1}
                            </span>
                            <span>«{job}»</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div className="mt-auto border-t border-white/8 pt-4">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">
                        {visual?.resonanceLabel ?? "Резонанс"}
                      </p>
                      <p className="mt-1 border-l-2 border-(--color-accent)/40 pl-2.5 text-xs leading-relaxed text-white/60">
                        {role.resonance}
                      </p>
                    </div>
                  </article>
                </FadeIn>
              </li>
            );
          })}
        </ul>
      </FadeIn>
    </>
  );
}
