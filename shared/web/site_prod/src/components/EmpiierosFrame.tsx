/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Frame for additive EmpiierOS public pages. Does not mount the Safe Workspace funnel.
 *
 * Invariants:
 * - Links back to `/` for Safe Workspace.
 * - No lead form, quiz, or /api/lead.
 */

import { BrandLogo } from "@/components/BrandLogo";
import {
  empiierosNav,
  empiierosOwner,
  empiierosPaths,
} from "@/content/empiieros";
import type { ReactNode } from "react";

export function EmpiierosFrame({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-[rgba(11,14,20,0.92)]">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <a href={empiierosPaths.workspace} className="flex items-center gap-2">
            <BrandLogo size={28} decorative className="h-7 w-7" />
            <span className="text-sm text-white/70">EmpiierOS</span>
          </a>
          <nav aria-label="EmpiierOS" className="flex flex-wrap gap-3 text-sm">
            {empiierosNav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-white/70 hover:text-(--color-accent)"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-10">{children}</main>
      <footer className="border-t border-white/10 px-4 py-8 text-sm text-white/50">
        <div className="mx-auto w-full max-w-3xl">
          <p>
            {empiierosOwner.status} {empiierosOwner.name}, ИНН {empiierosOwner.inn},
            ОГРНИП {empiierosOwner.ogrnip}
          </p>
          <p className="mt-2">
            <a className="text-(--color-accent)" href={`mailto:${empiierosOwner.email}`}>
              {empiierosOwner.email}
            </a>
            . Телефон {empiierosOwner.phone}. Часы поддержки {empiierosOwner.hours}.
          </p>
        </div>
      </footer>
    </div>
  );
}
