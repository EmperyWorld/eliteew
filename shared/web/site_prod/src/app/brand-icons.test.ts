/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Narrow lock: landing must ship Empery brand icons, not Next.js default favicon.
 *
 * Invariants:
 * - favicon.ico / icon.png / apple-icon.png exist under src/app and are non-trivial size.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appDir = join(process.cwd(), "src/app");

describe("site_prod brand icons", () => {
  it("ships favicon.ico, icon.png, and apple-icon.png (not empty Next stubs)", () => {
    const favicon = join(appDir, "favicon.ico");
    const icon = join(appDir, "icon.png");
    const apple = join(appDir, "apple-icon.png");

    for (const path of [favicon, icon, apple]) {
      expect(existsSync(path), `missing ${path}`).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(1024);
    }

    // PNG signature — rules out leftover Next placeholder text/svg stubs
    expect(readFileSync(icon).subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(readFileSync(apple).subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    // ICO magic: 00 00 01 00
    expect(readFileSync(favicon).subarray(0, 4)).toEqual(
      Buffer.from([0x00, 0x00, 0x01, 0x00]),
    );
  });
});
