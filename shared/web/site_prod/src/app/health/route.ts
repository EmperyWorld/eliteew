/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Health probe for container/smoke parity with legacy landing (:29002/health).
 *
 * Invariants:
 * - Plain text "healthy", noindex via header.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md
 */

import { NextResponse } from "next/server";

export function GET() {
  return new NextResponse("healthy", {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "no-store",
    },
  });
}
