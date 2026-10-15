/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Combined lead pack options (demo / PoC / ROI / TCO) and summary helper.
 *
 * Invariants:
 * - Interest ids match leadInterestSchema; no fluff / absolute claims.
 *
 * Related:
 * - CombinedLeadSection.tsx
 * - lib/leadSchema.ts
 */

import type { LeadInterest } from "@/lib/leadSchema";

export type LeadBundleOption = {
  id: LeadInterest;
  title: string;
  blurb: string;
  deliverable: string;
};

export const LEAD_BUNDLE_OPTIONS: readonly LeadBundleOption[] = [
  {
    id: "demo",
    title: "Демо-показ",
    blurb: "Короткий разбор EmpiierOS: x86_64, диск, отличие от облака",
    deliverable: "Созвон / демо",
  },
  {
    id: "poc",
    title: "Пилот (PoC)",
    blurb: "Запрос порядка поставки и состава материалов",
    deliverable: "Запрос поставки",
  },
  {
    id: "roi",
    title: "Оценка стоимости утечки",
    blurb: "Описание для реестра и закупки без номера записи на сайте",
    deliverable: "Разбор Discovery",
  },
  {
    id: "tco_table",
    title: "Таблица TCO",
    blurb: "Сравнение EmpiierOS, облака и готового дистрибутива",
    deliverable: "Таблица сравнения",
  },
] as const;

export const LEAD_BUNDLE_ANCHORS = [
  "demo",
  "poc",
  "roi",
  "tco",
  "contact",
] as const;

/** Map legacy section hashes to interest ids. */
export function interestFromHash(hash: string): LeadInterest | null {
  const h = hash.replace(/^#/, "").toLowerCase();
  if (h === "demo") return "demo";
  if (h === "poc") return "poc";
  if (h === "roi") return "roi";
  if (h === "tco" || h === "tco_table") return "tco_table";
  return null;
}

export function summarizeBundle(interests: readonly LeadInterest[]): {
  title: string;
  detail: string;
  count: number;
} {
  const unique = [...new Set(interests)];
  if (unique.length === 0) {
    return {
      title: "Выберите материалы",
      detail: "Отметьте один или несколько запросов — отправим одним пакетом.",
      count: 0,
    };
  }
  const labels = LEAD_BUNDLE_OPTIONS.filter((o) => unique.includes(o.id)).map(
    (o) => o.deliverable,
  );
  if (unique.length === 1) {
    const opt = LEAD_BUNDLE_OPTIONS.find((o) => o.id === unique[0]);
    return {
      title: opt?.title ?? "Запрос",
      detail: opt?.blurb ?? labels[0] ?? "",
      count: 1,
    };
  }
  const n = unique.length;
  const countWord =
    n === 2 || n === 3 || n === 4 ? "запроса" : n === 1 ? "запрос" : "запросов";
  return {
    title: `Комбинированный пакет · ${n} ${countWord}`,
    detail: `Одним контактом: ${labels.join(" · ")}. Согласуем порядок follow-up под ваш сегмент.`,
    count: n,
  };
}
