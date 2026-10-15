/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Multi-step Shadow IT risk quiz → score → lead capture.
 *
 * Invariants:
 * - Score visible before submit; API failure does not wipe local result.
 * - Progress UI is cosmetic; scoring stays in quizScore.
 * - Back only to already-answered steps.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md
 * - QuizSection.tsx · quizProgress.ts
 */

"use client";

import { useMemo, useState } from "react";
import { LeadCaptureForm } from "@/components/LeadCaptureForm";
import { QUIZ_META } from "@/components/quizVisual";
import { quiz } from "@/content/quiz";
import { quizProgressPct } from "@/lib/quizProgress";
import { scoreQuizAnswers, type QuizAnswers } from "@/lib/quizScore";
import { ChevronLeft } from "lucide-react";

const RISK_TONE: Record<string, string> = {
  low: "border-teal-300/30 bg-teal-400/10 text-teal-100",
  medium: "border-amber-300/30 bg-amber-400/10 text-amber-100",
  high: "border-rose-300/30 bg-rose-400/10 text-rose-100",
};

const RISK_LABEL: Record<string, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
};

export function RiskQuiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [done, setDone] = useState(false);

  const questions = quiz.questions;
  const current = questions[step];
  const progressPct = quizProgressPct(step, questions.length, done);
  const result = useMemo(
    () => (done ? scoreQuizAnswers(answers) : null),
    [answers, done],
  );

  function selectOption(optionId: string) {
    if (!current) return;
    const next = { ...answers, [current.id]: optionId };
    setAnswers(next);
    if (step + 1 >= questions.length) {
      setDone(true);
    } else {
      setStep(step + 1);
    }
  }

  function goToStep(index: number) {
    if (index < 0 || index >= questions.length) return;
    const target = questions[index];
    if (!target) return;
    const answeredOrCurrent =
      index <= step || Boolean(answers[target.id]) || done;
    if (!answeredOrCurrent && index > step) return;
    setDone(false);
    setStep(index);
  }

  function goBack() {
    if (step <= 0) return;
    setDone(false);
    setStep(step - 1);
  }

  function restart() {
    setAnswers({});
    setStep(0);
    setDone(false);
  }

  if (done && result) {
    const tone = RISK_TONE[result.riskProfileId] ?? RISK_TONE.medium;
    return (
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div className="rounded-2xl border border-white/10 bg-[#070a10]/70 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${tone}`}
            >
              {RISK_LABEL[result.riskProfileId] ?? "Средний"}
            </span>
            <p className="text-xs text-white/45">
              Баллы {result.score}/{result.maxScore}
            </p>
            <span className="rounded-md border border-white/12 bg-white/4 px-2 py-0.5 text-[10px] text-white/45">
              на экране · не юр. аудит
            </span>
          </div>
          <h3 className="mt-3 text-lg font-medium text-white sm:text-xl">
            {result.riskTitle}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            {result.riskSummary}
          </p>
          <div className="mt-4 rounded-xl border border-white/10 bg-black/30 px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">
              {QUIZ_META.resultNextEyebrow}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/55">
              {QUIZ_META.resultNextHint}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={restart}
              className="text-xs text-white/50 underline-offset-2 hover:text-white/80 hover:underline"
            >
              Пройти снова
            </button>
            <a
              href="#contact"
              className="text-xs text-(--color-accent) underline-offset-2 hover:underline"
            >
              Или сразу к пакету контакта →
            </a>
          </div>
        </div>
        <div className="rounded-2xl border border-teal-300/20 bg-black/25 p-4 sm:p-5 lg:sticky lg:top-24">
          <LeadCaptureForm
            intent="quiz"
            title="Получить разбор зон риска и следующий шаг"
            submitLabel="Отправить контакт"
            quizResults={{
              answers,
              score: result.score,
              risk_profile: result.riskTitle,
            }}
          />
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between gap-3 text-xs text-white/45">
          <span>
            Вопрос {step + 1} из {questions.length}
          </span>
          <span>{progressPct}%</span>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPct}
          aria-label="Прогресс экспресс-аудита"
        >
          <div
            className="h-full rounded-full bg-(--color-accent) transition-[width] duration-300"
            style={{ width: `${Math.max(progressPct, 8)}%` }}
          />
        </div>

        <ol className="mt-4 flex flex-wrap gap-1.5" aria-label="Шаги аудита">
          {questions.map((q, index) => {
            const answered = Boolean(answers[q.id]);
            const isCurrent = index === step;
            return (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => goToStep(index)}
                  disabled={!answered && index > step}
                  className={[
                    "rounded-md border px-2 py-1 text-[10px] transition",
                    isCurrent
                      ? "border-cyan-300/40 bg-cyan-400/15 text-(--color-accent)"
                      : answered
                        ? "border-white/15 bg-white/5 text-white/70 hover:border-white/30"
                        : "border-white/8 bg-transparent text-white/30",
                    !answered && index > step ? "cursor-not-allowed" : "",
                  ].join(" ")}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {index + 1}. {q.shortLabel}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#070a10]/55 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-teal-300/25 bg-teal-400/10 px-2 py-0.5 text-[10px] text-teal-100/90">
            {current.shortLabel}
          </span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-white/35">
            вопрос {step + 1}/{questions.length}
          </span>
        </div>
        <h3 className="mt-3 text-lg font-medium leading-snug text-white sm:text-xl">
          {current.prompt}
        </h3>

        <div
          className="mt-4 flex flex-col gap-2.5"
          role="listbox"
          aria-label={current.prompt}
        >
          {current.options.map((opt, optIndex) => {
            const selected = answers[current.id] === opt.id;
            const mark =
              QUIZ_META.optionMarks[optIndex] ?? String(optIndex + 1);
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => selectOption(opt.id)}
                className={[
                  "flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)",
                  selected
                    ? "border-cyan-300/40 bg-cyan-400/10 text-white"
                    : "border-white/15 bg-black/25 text-white/85 hover:border-(--color-accent) hover:bg-black/40",
                ].join(" ")}
              >
                <span
                  className={[
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-[11px] font-medium",
                    selected
                      ? "border-cyan-300/40 bg-cyan-400/15 text-(--color-accent)"
                      : "border-white/15 bg-white/5 text-white/45",
                  ].join(" ")}
                  aria-hidden
                >
                  {mark}
                </span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {step > 0 ? (
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-1 text-xs text-white/45 transition hover:text-white/75"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          Предыдущий вопрос
        </button>
      ) : null}
    </div>
  );
}
