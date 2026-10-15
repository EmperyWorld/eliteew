/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Visual metadata for cloud/distro vs EmpiierOS differentiation rows.
 *
 * Related:
 * - ComparisonSection.tsx
 * - content/comparison.ts
 */

export const COMPARISON_ROW_VISUAL: Record<
  string,
  { dlpTag: string; eliteTag: string }
> = {
  "Где работает": {
    dlpTag: "Вкладка / live-образ",
    eliteTag: "Диск x86_64",
  },
  "Основа пола": {
    dlpTag: "SaaS / готовый Fedora",
    eliteTag: "Buildroot · 6.12.20",
  },
  "Реестр и продажи": {
    dlpTag: "Ожидание номера",
    eliteTag: "Записи нет · 0 ₽",
  },
  Сертификация: {
    dlpTag: "Путаница с СЗИ",
    eliteTag: "Сертификата СЗИ нет",
  },
};

export const COMPARISON_SPEED = {
  dlp: {
    label: "Облако / дистрибутив",
    scale: "Не диск ОС",
    detail: "вкладка · чужой live-образ",
    status: "другой класс",
  },
  elite: {
    label: "EmpiierOS",
    scale: "Локальный сеанс",
    detail: "UEFI · LUKS · Wayland",
    status: "x86_64 · disk",
  },
} as const;

export const COMPARISON_META = {
  speedEyebrow: "Класс продукта · не смешивать",
  contrastHint: "облако → диск",
  caption: "EmpiierOS на диске — не кабинет app.eliteew.ru и не Fedora-киоск.",
  leadCriterion: "Где работает",
  ctaEyebrow: "Следующий шаг · цена",
  ctaHint: "Порядок цены → /empiieros/price или #contact",
} as const;

export function hasVisualForCriterion(criterion: string): boolean {
  return criterion in COMPARISON_ROW_VISUAL;
}
