/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Closer dual CTA for EmpiierOS supply request.
 *
 * Related:
 * - reestr-mintsifry/11-website/cms-copy-paste.ru.md
 */

import type { CtaSpec } from "./types";

export const closer = {
  id: "closer",
  eyebrow: "Action · следующий шаг",
  flowHint: "квиз готовности или запрос · без давления",
  title: "Следующий шаг",
  statement:
    "EmpiierOS — локальная операционная система на диске. Продаж не было; порядок поставки и цена — по запросу после готовности.",
  trustNotes: [
    "x86_64 · русская оболочка",
    "Запись в реестре: нет",
    "Не оферта на странице",
  ],
  orLabel: "или",
  ctas: [
    {
      label: "Проверить готовность к поставке",
      intent: "quiz",
      href: "#quiz",
      variant: "primary",
    },
    {
      label: "Запросить порядок поставки",
      intent: "poc",
      href: "#contact",
      variant: "secondary",
    },
  ] as const satisfies readonly CtaSpec[],
} as const;
