/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sticky landing header — brand, section nav, session chip, primary contact CTA.
 *
 * Invariants:
 * - In-page anchors only; mobile menu is progressive enhancement.
 * - SessionStatus remains honest (Data Isolated), not absolute security claim.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md
 * - headerNav.ts · BrandLogo.tsx
 */

"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import {
  HEADER_META,
  HEADER_NAV,
  headerSectionId,
  type HeaderNavHref,
} from "@/components/headerNav";
import { SessionStatus } from "@/components/SessionStatus";
import { brand } from "@/content";
import { Menu, X } from "lucide-react";

function navLinkClass(active: boolean): string {
  return [
    "rounded-md px-2 py-1 text-sm transition",
    active
      ? "bg-cyan-400/10 text-(--color-accent)"
      : "text-white/60 hover:text-(--color-accent)",
  ].join(" ");
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeHref, setActiveHref] = useState<HeaderNavHref | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const nodes = HEADER_NAV.map((item) =>
      document.getElementById(headerSectionId(item.href)),
    ).filter((el): el is HTMLElement => el != null);

    if (nodes.length === 0) return;

    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let bestId: string | null = null;
        let bestRatio = 0;
        for (const [id, ratio] of ratios) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }
        if (bestId && bestRatio > 0) {
          setActiveHref(`#${bestId}` as HeaderNavHref);
        }
      },
      { rootMargin: "-18% 0px -55% 0px", threshold: [0, 0.15, 0.35, 0.55] },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={[
        "sticky top-0 z-40 border-b backdrop-blur-md transition-[background-color,box-shadow,border-color]",
        scrolled
          ? "border-white/12 bg-[rgba(11,14,20,0.92)] shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
          : "border-white/10 bg-[rgba(11,14,20,0.82)]",
      ].join(" ")}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-3.5 lg:px-8">
        <a
          href="#hook"
          className="group flex min-w-0 shrink-0 items-center gap-2.5"
          onClick={() => setOpen(false)}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-cyan-300/30 bg-cyan-400/10 p-1 transition group-hover:border-cyan-300/50">
            <BrandLogo size={28} decorative className="h-7 w-7" />
          </span>
          <span className="min-w-0">
            <p className="text-base font-semibold tracking-tight text-(--color-accent) sm:text-lg">
              {brand.productName}
            </p>
            <p className="truncate text-[11px] text-white/45 sm:text-xs">
              {brand.positioning}
            </p>
          </span>
        </a>

        <nav
          className="hidden items-center gap-1 lg:flex"
          aria-label="Основные разделы"
        >
          {HEADER_NAV.map((item) => {
            const active = activeHref === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={navLinkClass(active)}
              >
                {item.label}
              </a>
            );
          })}
          <a
            href="/empiieros/description"
            className="rounded-md px-2 py-1 text-sm text-white/60 hover:text-(--color-accent)"
          >
            Описание
          </a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <SessionStatus
            className="hidden md:inline-flex"
            label={HEADER_META.sessionLabel}
          />
          <a
            href="#contact"
            className="hidden rounded-lg bg-(--color-cta) px-3.5 py-2 text-sm font-medium text-(--color-bg) shadow-[0_0_20px_rgba(45,212,191,0.25)] transition hover:brightness-110 sm:inline-flex"
          >
            {HEADER_META.contactCta}
          </a>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 text-white/80 transition hover:border-(--color-accent)/40 hover:text-(--color-accent) lg:hidden"
            aria-expanded={open}
            aria-controls="site-header-menu"
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <X className="h-5 w-5" aria-hidden />
            ) : (
              <Menu className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {open ? (
        <div
          id="site-header-menu"
          className="border-t border-white/10 bg-[rgba(11,14,20,0.96)] px-4 py-4 lg:hidden"
        >
          <p className="mb-2 px-3 text-[10px] uppercase tracking-[0.16em] text-white/35">
            Разделы
          </p>
          <nav className="flex flex-col gap-1" aria-label="Мобильная навигация">
            {HEADER_NAV.map((item) => {
              const active = activeHref === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "rounded-lg px-3 py-2.5 text-sm transition",
                    active
                      ? "bg-cyan-400/10 text-(--color-accent)"
                      : "text-white/75 hover:bg-white/5 hover:text-(--color-accent)",
                  ].join(" ")}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              );
            })}
            <a
              href="/empiieros/description"
              className="rounded-lg px-3 py-2.5 text-sm text-white/75 hover:bg-white/5 hover:text-(--color-accent)"
              onClick={() => setOpen(false)}
            >
              Описание
            </a>
            <a
              href="#contact"
              className="mt-2 rounded-lg bg-(--color-cta) px-3 py-2.5 text-center text-sm font-medium text-(--color-bg)"
              onClick={() => setOpen(false)}
            >
              {HEADER_META.contactCtaMobile}
            </a>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
