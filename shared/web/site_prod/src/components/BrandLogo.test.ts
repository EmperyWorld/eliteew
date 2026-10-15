/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock public Empery logo asset used by BrandLogo / footer.
 *
 * Related:
 * - BrandLogo.tsx
 * - public/logo_empery.png
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_LOGO } from "./BrandLogo";

describe("BrandLogo asset", () => {
  it("points at public logo_empery.png with PNG signature", () => {
    expect(BRAND_LOGO.src).toBe("/logo_empery.png");
    const path = join(process.cwd(), "public", "logo_empery.png");
    expect(existsSync(path), `missing ${path}`).toBe(true);
    expect(statSync(path).size).toBeGreaterThan(8_000);
    expect(readFileSync(path).subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it("serves logo via plain img path (not Next image optimizer)", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/BrandLogo.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/from ["']next\/image["']/);
    expect(src).toMatch(/<img\b/);
    expect(src).toContain(BRAND_LOGO.src);
  });
});
