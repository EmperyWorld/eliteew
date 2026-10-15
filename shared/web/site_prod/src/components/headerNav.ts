/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact in-page nav for sticky landing header.
 *
 * Invariants:
 * - Hrefs stay on-page (#…); primary exit is #contact / #quiz.
 *
 * Related:
 * - SiteHeader.tsx
 * - footerNav.ts
 */

export const HEADER_META = {
  sessionLabel: "x86_64 · local seat",
  contactCta: "Контакт",
  contactCtaMobile: "Контакт · комбинированный пакет",
} as const;

export const HEADER_NAV = [
  { href: "#solution", label: "Решение" },
  { href: "#comparison", label: "Сравнение" },
  { href: "#proof", label: "Proof" },
  { href: "#quiz", label: "Аудит" },
] as const;

export type HeaderNavHref = (typeof HEADER_NAV)[number]["href"];

export function headerSectionId(href: string): string {
  return href.startsWith("#") ? href.slice(1) : href;
}
