/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public landing footer — brand, in-page nav, structured privacy panel, app entry.
 *
 * Invariants:
 * - Privacy copy from brand.privacyPanel / privacyNotice; no absolute security claims.
 * - Nav is in-page anchors only (no fake legal routes).
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md
 * - content/brand.ts · footerNav.ts
 */

import { BrandLogo } from "@/components/BrandLogo";
import { FOOTER_NAV } from "@/components/footerNav";
import { brand, privacyPanel } from "@/content";
import { Shield } from "lucide-react";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative border-t border-white/10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-400/40 to-transparent"
      />
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <a
              href="#hook"
              className="group inline-flex max-w-full items-center gap-3"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-cyan-300/25 bg-cyan-400/8 p-1.5 shadow-[0_0_24px_rgba(0,242,255,0.08)] transition group-hover:border-cyan-300/45">
                <BrandLogo size={36} decorative className="h-9 w-9" />
              </span>
              <span className="min-w-0">
                <p className="text-lg font-semibold tracking-tight text-(--color-accent)">
                  {brand.productName}
                </p>
                <p className="mt-0.5 text-sm text-white/55">{brand.positioning}</p>
              </span>
            </a>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/45">
              {brand.tagline}. Разделение рабочего и личного контура на BYOD — без
              вторжения в личное пространство.
            </p>
            <p className="mt-4 text-xs text-white/35">
              © {year} {brand.companyName}
            </p>
          </div>

          <nav aria-label="Разделы лендинга">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
              На странице
            </p>
            <ul className="mt-3 space-y-2">
              {FOOTER_NAV.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="text-sm text-white/60 transition hover:text-(--color-accent)"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
              Продукт
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a
                  href={brand.publicUrl}
                  className="text-white/60 transition hover:text-(--color-accent)"
                >
                  {brand.publicUrl.replace(/^https:\/\//, "")}
                </a>
              </li>
              <li>
                <a
                  href={brand.appUrl}
                  className="text-white/60 transition hover:text-(--color-accent)"
                >
                  Приложение · app.eliteew.ru
                </a>
              </li>
              <li>
                <a
                  href={brand.sourceUrl}
                  className="text-white/60 transition hover:text-(--color-accent)"
                >
                  Исходный код · MIT
                </a>
              </li>
              <li>
                <a
                  href="/empiieros"
                  className="text-white/60 transition hover:text-(--color-accent)"
                >
                  EmpiierOS · операционная система
                </a>
              </li>
              <li>
                <a
                  href="#contact"
                  className="text-white/60 transition hover:text-(--color-accent)"
                >
                  Запросить пакет материалов
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-white/10 bg-black/25 px-4 py-5 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-400/10 text-(--color-accent)">
                <Shield className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 max-w-2xl">
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                  {privacyPanel.title}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-white/55 sm:text-sm">
                  {privacyPanel.lead}
                </p>
              </div>
            </div>
            <a
              href={privacyPanel.contactHref}
              className="shrink-0 text-xs text-(--color-accent)/90 transition hover:text-(--color-accent)"
            >
              {privacyPanel.contactLabel} →
            </a>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-teal-200/70">
                Собираем
              </p>
              <ul className="mt-2 space-y-2">
                {privacyPanel.collect.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-xs leading-relaxed text-white/50"
                  >
                    <span
                      className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-300/70"
                      aria-hidden
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                Не делаем
              </p>
              <ul className="mt-2 space-y-2">
                {privacyPanel.never.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-xs leading-relaxed text-white/50"
                  >
                    <span
                      className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/35"
                      aria-hidden
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
