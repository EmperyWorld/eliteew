/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Hero dual-path CTA labels and trust signals (no absolute security claims).
 *
 * Invariants:
 * - Soft path = quiz; hard path = demo/contact; trust chips stay factual.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md §Hero
 * - /home/owned/site_doc/dialog.md block 1
 */

import type { LeadIntent } from "@/content/types";

export type HeroPathMeta = {
  eyebrow: string;
  hint: string;
};

export const HERO_PATH_BY_INTENT: Partial<Record<LeadIntent, HeroPathMeta>> = {
  quiz: {
    eyebrow: "01 · Мягкий вход",
    hint: "5 вопросов → профиль готовности к поставке",
  },
  demo: {
    eyebrow: "02 · Прямой путь",
    hint: "Порядок поставки · заявка в комбинированной форме",
  },
};

export const HERO_TRUST_SIGNALS = [
  { id: "arch", label: "x86_64" },
  { id: "disk", label: "Установка на диск" },
  { id: "registry", label: "Реестр: нет" },
  { id: "price", label: "Цена по запросу" },
] as const;

export function heroPathForIntent(intent: LeadIntent): HeroPathMeta | undefined {
  return HERO_PATH_BY_INTENT[intent];
}
