/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Narrow lock for default ENROLL/APP bases (Wave 1).
 *
 * Invariants:
 * - Defaults stay on private app host (not a public enroll subdomain).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md
 */

import { describe, expect, it } from "vitest";
import { getDesktopClientBases } from "./bases";

describe("getDesktopClientBases", () => {
  it("defaults enroll and app to app.eliteew.ru when env empty", () => {
    const bases = getDesktopClientBases();
    expect(bases.enrollBase).toBe("https://app.eliteew.ru");
    expect(bases.appBase).toBe("https://app.eliteew.ru");
  });
});
