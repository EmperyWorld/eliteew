/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Site footer nav targets for eliteew.ru landing (in-page anchors).
 *
 * Invariants:
 * - Hrefs stay on-page (#…); no invented legal pages without content.
 *
 * Related:
 * - SiteFooter.tsx
 */

export const FOOTER_NAV = [
  { href: "#hook", label: "Старт" },
  { href: "#problem", label: "Проблема" },
  { href: "#solution", label: "Состав ОС" },
  { href: "#comparison", label: "Сравнение" },
  { href: "#proof", label: "Доказательства" },
  { href: "#quiz", label: "Готовность" },
  { href: "#contact", label: "Контакт" },
] as const;
