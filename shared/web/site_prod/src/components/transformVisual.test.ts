/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Layering stage A/B vocabulary for the hero TransformationScene.
 *
 * Invariants:
 * - Dome stage uses separation framing.
 *
 * Related:
 * - transformVisual.ts
 */

import { describe, expect, it } from "vitest";
import {
  LAYERING_DEVICE,
  LAYERING_STAGE,
  layeringStageActiveId,
} from "@/components/transformVisual";

describe("transformVisual", () => {
  it("exposes A chaos and B dome stages", () => {
    expect(LAYERING_STAGE.stages).toHaveLength(2);
    expect(LAYERING_STAGE.stages[0]?.id).toBe("chaos");
    expect(LAYERING_STAGE.stages[1]?.id).toBe("dome");
    expect(LAYERING_STAGE.flowHint).toMatch(/один клик/i);
    expect(LAYERING_STAGE.stages[0]?.tone).toBe("risk");
    expect(LAYERING_STAGE.stages[1]?.tone).toBe("safe");
  });

  it("maps dome toggle to active stage id", () => {
    expect(layeringStageActiveId(false)).toBe("chaos");
    expect(layeringStageActiveId(true)).toBe("dome");
  });

  it("locks Stage A device chrome risk framing", () => {
    expect(LAYERING_DEVICE.stageABadge).toMatch(/этап A/i);
    expect(LAYERING_DEVICE.riskBanner.toLowerCase()).toMatch(/периметр|окна|каналах/);
    expect(LAYERING_DEVICE.addressBar).toMatch(/BYOD/i);
    expect(LAYERING_DEVICE.riskBanner.toLowerCase()).not.toMatch(/слежка|мониторинг сотрудников/);
  });

  it("keeps dome hint separation-framed", () => {
    const dome = LAYERING_STAGE.stages.find((s) => s.id === "dome");
    expect(dome?.hint).toMatch(/диск|локальн|облак/i);
    expect(dome?.hint).not.toMatch(/мониторинг|слежка/i);
  });
});
