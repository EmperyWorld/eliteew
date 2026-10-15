/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public lead capture endpoint for quiz / single intents / combined bundle.
 *
 * Invariants:
 * - Validates with zod; never silent-success on persist failure.
 * - Rate-limited per client IP.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md
 */

import { NextResponse } from "next/server";
import { leadPayloadSchema } from "@/lib/leadSchema";
import { persistLead } from "@/lib/leadStore";
import { allowRequest } from "@/lib/rateLimit";

export const runtime = "nodejs";

function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: Request) {
  const gate = allowRequest(clientKey(req));
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: "too_many_requests" },
      {
        status: 429,
        headers: { "Retry-After": String(gate.retryAfterSec) },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = leadPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.intent === "quiz" && !parsed.data.quiz_results) {
    return NextResponse.json(
      { ok: false, error: "quiz_results_required" },
      { status: 400 },
    );
  }

  if (parsed.data.intent === "bundle" && (!parsed.data.interests || parsed.data.interests.length < 1)) {
    return NextResponse.json(
      { ok: false, error: "interests_required" },
      { status: 400 },
    );
  }

  try {
    const stored = await persistLead(parsed.data);
    return NextResponse.json({
      ok: true,
      id: stored.id,
      intent: stored.intent,
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        step: "lead_persist_fail",
        message: err instanceof Error ? err.message : "unknown",
      }),
    );
    return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
  }
}
