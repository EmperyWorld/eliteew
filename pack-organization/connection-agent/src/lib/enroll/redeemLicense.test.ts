/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 5 lock: redeemLicense helper is fail-closed (capsule activation only).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md F-06
 */

import { describe, expect, it } from "vitest";
import { redeemLicense } from "./redeemLicense";

describe("redeemLicense", () => {
  it("returns license_redeem_removed without invoking native HTTP", async () => {
    const result = await redeemLicense({
      enrollBase: "https://app.eliteew.ru",
      licenseKey: "lk_test",
      devicePubkey: "pk_test",
      machineFingerprint: "fp_testhostfingerprint",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("license_redeem_removed");
      expect(result.message.length).toBeGreaterThan(8);
    }
  });
});
