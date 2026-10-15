/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock lead bundle options, hash mapping, and summarizeBundle combinations.
 *
 * Related:
 * - leadBundle.ts
 * - lib/leadSchema.ts
 */

import { describe, expect, it } from "vitest";
import {
  interestFromHash,
  LEAD_BUNDLE_OPTIONS,
  summarizeBundle,
} from "./leadBundle";
import { leadPayloadSchema } from "@/lib/leadSchema";

describe("leadBundle", () => {
  it("exposes four interest options matching schema", () => {
    expect(LEAD_BUNDLE_OPTIONS.map((o) => o.id).sort()).toEqual([
      "demo",
      "poc",
      "roi",
      "tco_table",
    ]);
  });

  it("maps legacy hashes to interests", () => {
    expect(interestFromHash("#demo")).toBe("demo");
    expect(interestFromHash("tco")).toBe("tco_table");
    expect(interestFromHash("#contact")).toBeNull();
  });

  it("summarizes combined package when multiple interests selected", () => {
    const s = summarizeBundle(["demo", "poc", "tco_table"]);
    expect(s.title).toContain("Комбинированный пакет");
    expect(s.count).toBe(3);
    expect(s.detail).toContain("·");
  });

  it("returns count 0 when empty", () => {
    expect(summarizeBundle([]).count).toBe(0);
  });
});

describe("leadPayloadSchema bundle", () => {
  it("accepts bundle with interests", () => {
    const parsed = leadPayloadSchema.safeParse({
      intent: "bundle",
      interests: ["demo", "poc"],
      contact: { email: "a@b.co", companySize: "100-1000" },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects bundle without interests", () => {
    const parsed = leadPayloadSchema.safeParse({
      intent: "bundle",
      contact: { email: "a@b.co", companySize: "100-1000" },
    });
    expect(parsed.success).toBe(false);
  });
});
