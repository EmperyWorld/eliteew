/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Hero (Hook) copy for EmpiierOS — local x86_64 OS, dual CTA.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md §Hero
 * - reestr-mintsifry/11-website/cms-copy-paste.ru.md
 */

import type { CtaSpec } from "./types";

export const hero = {
  id: "hook",
  eyebrow: "x86_64 · Linux · русская оболочка",
  h1Pain: "Нужно рабочее место на диске, а не вкладка в облаке?",
  h1Promise: "EmpiierOS — операционная система для рабочего компьютера",
  subheadline:
    "Пол собран из исходников Linux. Графический сеанс Wayland, оболочка по умолчанию на русском. Это не Safe Workspace и не кабинет app.eliteew.ru.",
  visualBrief:
    "Нажмите «Открыть рабочее место»: локальный сеанс EmpiierOS поверх диска компьютера, без облачной вкладки",
  audienceChips: [
    "Только x86_64",
    "Установка на диск",
    "Запись в реестре: нет",
  ] as const,
  ctas: [
    {
      label: "Проверить готовность к поставке",
      intent: "quiz",
      href: "#quiz",
      variant: "primary",
    },
    {
      label: "Запросить порядок поставки",
      intent: "demo",
      href: "#contact",
      variant: "secondary",
    },
  ] as const satisfies readonly CtaSpec[],
} as const;
