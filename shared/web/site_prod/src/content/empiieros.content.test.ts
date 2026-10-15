/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock EmpiierOS public copy: on-request price, no registry claim, no sales.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  empiierosFacts,
  empiierosMeta,
  empiierosPaths,
  empiierosPrice,
} from "./empiieros";

describe("empiieros public copy", () => {
  it("publishes the price route and an on-request sentence", () => {
    expect(empiierosPaths.price).toBe("/empiieros/price");
    expect(empiierosPrice.lead).toMatch(/по запросу/i);
    expect(empiierosPrice.body).toMatch(/не было/);
    expect(empiierosFacts.sales).toBe("не было");
    expect(empiierosFacts.registry).toBe("записи нет");
  });

  it("does not publish a tariff, a registry number, or a support schedule", () => {
    expect(empiierosPrice.lead).not.toMatch(/\d/);
    expect(empiierosPrice.body).toContain("0 ₽");
    expect(empiierosPrice.body).not.toMatch(/включен[ао] в реестр/i);
    expect(empiierosMeta.docsDescription).toMatch(/не опубликованы/);
  });

  it("keeps EmpiierOS funnel home and adds deep docs link in the header source", () => {
    const header = readFileSync(
      join(process.cwd(), "src/components/SiteHeader.tsx"),
      "utf8",
    );
    expect(header).toMatch(/href="\/empiieros(\/description)?"/);
    const home = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(home).toContain("LandingPage");
  });
});
