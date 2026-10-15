/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * MVP lead persistence: append-only JSONL + optional webhook (env).
 *
 * Invariants:
 * - No secrets in client; webhook URL only from env LEAD_WEBHOOK_URL.
 * - Failures are logged; caller decides HTTP status.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md
 */

import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { LeadPayload } from "@/lib/leadSchema";

const DATA_DIR = process.env.LEAD_DATA_DIR?.trim() || "/tmp/eliteew-leads";
const LEADS_FILE = path.join(DATA_DIR, "leads.jsonl");

export type StoredLead = LeadPayload & {
  id: string;
  received_at: string;
};

export async function persistLead(payload: LeadPayload): Promise<StoredLead> {
  const record: StoredLead = {
    ...payload,
    id: crypto.randomUUID(),
    received_at: new Date().toISOString(),
  };

  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(LEADS_FILE, `${JSON.stringify(record)}\n`, "utf8");

  const webhook = process.env.LEAD_WEBHOOK_URL?.trim();
  if (webhook) {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    if (!res.ok) {
      console.error(
        JSON.stringify({
          level: "error",
          step: "lead_webhook_fail",
          status: res.status,
          lead_id: record.id,
        }),
      );
    }
  }

  console.info(
    JSON.stringify({
      level: "info",
      step: "lead_stored",
      lead_id: record.id,
      intent: record.intent,
      interests: record.interests,
      companySize: record.contact.companySize,
    }),
  );

  return record;
}
