/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock JTBD visual keys to content role ids; ban surveillance fluff in visual layer.
 *
 * Invariants:
 * - Every jobs.roles id has visual metadata.
 *
 * Related:
 * - jobsVisual.ts
 * - content/jobs.ts
 */

import { describe, expect, it } from "vitest";
import { jobs } from "@/content";
import {
  hasVisualForJobRole,
  JOB_COMMITTEE_META,
  JOB_COMMITTEE_ORDER,
  JOB_ROLE_VISUAL,
} from "./jobsVisual";

describe("jobsVisual", () => {
  it("covers every jobs.roles id in visual map and committee order", () => {
    expect(JOB_COMMITTEE_ORDER).toEqual(["ciso", "ceo", "employee"]);
    expect(JOB_COMMITTEE_META.flowHint).toMatch(/принимает/i);
    expect(jobs.audienceChips.length).toBeGreaterThanOrEqual(3);
    expect(jobs.audienceChips.join(" ")).toMatch(/x86_64/i);
    expect(jobs.audienceChips.join(" ").toLowerCase()).toMatch(/luks|диск/);
    for (const role of jobs.roles) {
      expect(hasVisualForJobRole(role.id)).toBe(true);
      expect(JOB_ROLE_VISUAL[role.id].focus.length).toBeGreaterThan(0);
      expect(JOB_ROLE_VISUAL[role.id].badge.length).toBeGreaterThan(0);
      expect(["lead", "buyer", "user"]).toContain(JOB_ROLE_VISUAL[role.id].tone);
    }
  });

  it("keeps employee focus on separation, not surveillance", () => {
    const employee = JOB_ROLE_VISUAL.employee;
    expect(employee.focus.toLowerCase()).toContain("разделен");
    const blob = JSON.stringify(JOB_ROLE_VISUAL).toLowerCase();
    expect(blob).not.toContain("мониторинг сотрудников");
    expect(blob).not.toContain("контроль за людьми");
    expect(blob).not.toContain("слежка");
    expect(JOB_ROLE_VISUAL.ciso.step).toBe("01");
  });
});
