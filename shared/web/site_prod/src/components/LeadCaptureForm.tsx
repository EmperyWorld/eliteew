/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared contact fields + submit to POST /api/lead for funnel intents.
 *
 * Invariants:
 * - Shows honest error state; never claims success without ok:true.
 * - Privacy notice always visible near submit.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md
 */

"use client";

import { useState } from "react";
import { privacyNotice } from "@/content/brand";
import type { LeadIntent } from "@/lib/leadSchema";

type LeadCaptureFormProps = {
  intent: LeadIntent;
  title: string;
  submitLabel: string;
  quizResults?: {
    answers: Record<string, string>;
    score: number;
    risk_profile: string;
  };
  onSuccess?: (id: string) => void;
};

export function LeadCaptureForm({
  intent,
  title,
  submitLabel,
  quizResults,
  onSuccess,
}: LeadCaptureFormProps) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [companySize, setCompanySize] = useState<"1-99" | "100-1000" | "1000+">(
    "100-1000",
  );
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent,
          contact: {
            email: email.trim(),
            phone: phone.trim() || undefined,
            name: name.trim() || undefined,
            companySize,
          },
          quiz_results: quizResults,
          source: "site_prod",
        }),
      });
      const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
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
      onSuccess?.(data.id);
    } catch {
      setStatus("error");
      setError("Сеть недоступна. Результат квиза сохранён локально на экране — повторите отправку позже.");
    }
  }

  if (status === "ok") {
    return (
      <div className="rounded-xl border border-teal-400/30 bg-teal-400/10 p-4 text-sm text-teal-100">
        Заявка принята. Мы свяжемся по указанному контакту.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h3 className="text-base font-medium text-white">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-white/55 sm:col-span-2">
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
        <label className="block text-xs text-white/55 sm:col-span-2">
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
      {error && (
        <p className="text-sm text-amber-200/90" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-lg bg-(--color-cta) px-5 py-2.5 text-sm font-medium text-(--color-bg) disabled:opacity-60"
      >
        {status === "loading" ? "Отправка…" : submitLabel}
      </button>
    </form>
  );
}
