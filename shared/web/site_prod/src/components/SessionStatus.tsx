/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pulsing session status chip — isolation signal without absolute security claims.
 *
 * Invariants:
 * - Labels are honest (Data Isolated / Secure Session Active), never “100% secure”.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md
 */

"use client";

type SessionStatusProps = {
  label?: string;
  className?: string;
};

export function SessionStatus({
  label = "Data Isolated",
  className = "",
}: SessionStatusProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-xs font-medium text-teal-200",
        className,
      ].join(" ")}
      role="status"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-300 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-300" />
      </span>
      {label}
    </span>
  );
}
