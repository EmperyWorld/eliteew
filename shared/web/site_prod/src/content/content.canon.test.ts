/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Narrow lock: content barrel exports required funnel pieces and ToV bans.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md
 */

import { describe, expect, it } from "vitest";
import {
  brand,
  closer,
  comparison,
  contactPack,
  hero,
  jobs,
  privacyNotice,
  privacyPanel,
  problem,
  proof,
  solution,
  vocabulary,
} from "./index";

describe("site_prod content canon", () => {
  it("locks brand and EmpiierOS positioning", () => {
    expect(brand.productName).toBe("EmpiierOS");
    expect(brand.positioning).toBe("операционная система");
    expect(brand.publicUrl).toContain("eliteew.ru");
    expect(brand.sourceUrl).toBe("https://github.com/EmperyWorld/eliteew");
  });

  it("exposes structured privacy panel for footer", () => {
    expect(privacyPanel.collect.length).toBeGreaterThanOrEqual(2);
    expect(privacyPanel.never.length).toBeGreaterThanOrEqual(2);
    expect(privacyPanel.contactHref).toBe("#contact");
    const neverBlob = privacyPanel.never.join(" ");
    expect(neverBlob).toMatch(/не читаем|не устанавливаем/i);
  });

  it("exposes funnel pieces with dual CTAs and JTBD roles", () => {
    expect(hero.ctas).toHaveLength(2);
    expect(hero.ctas.map((c) => c.intent)).toEqual(["quiz", "demo"]);
    expect(problem.scenarios).toHaveLength(3);
    expect(jobs.roles.map((r) => r.id)).toEqual(["ciso", "ceo", "employee"]);
    expect(jobs.roles.every((r) => r.jobs.length >= 2)).toBe(true);
    expect(solution.pillars).toHaveLength(3);
    expect(comparison.rows.length).toBeGreaterThanOrEqual(4);
    expect(proof.facts.length).toBeGreaterThanOrEqual(2);
    expect(proof.faq).toHaveLength(4);
    expect(closer.ctas.map((c) => c.intent)).toEqual(["quiz", "poc"]);
    expect(closer.flowHint.toLowerCase()).toMatch(/без давления/);
    expect(contactPack.id).toBe("contact");
    expect(contactPack.flowHint.toLowerCase()).toMatch(/demo|poc|roi|описание|цена/);
    expect(contactPack.submitLabel.length).toBeGreaterThan(0);
  });

  it("keeps fluff and absolute guarantees out of published strings", () => {
    const blob = [
      hero.h1Pain,
      hero.h1Promise,
      hero.subheadline,
      ...hero.audienceChips,
      problem.title,
      solution.identity,
      ...solution.trustNotes,
      comparison.killerArgument,
      closer.statement,
      ...closer.trustNotes,
      contactPack.title,
      contactPack.intro,
      contactPack.successHint,
      privacyNotice,
      privacyPanel.lead,
      ...privacyPanel.collect,
      ...privacyPanel.never,
      jobs.title,
      jobs.intro,
      ...jobs.roles.flatMap((r) => [r.pain, r.resonance, ...r.jobs]),
      ...proof.facts.map((f) => f.body),
      ...proof.hypotheses.map((h) => h.body),
      proof.faqIntro,
      ...proof.faq.flatMap((f) => [f.q, f.a, f.proof]),
    ].join("\n");

    for (const word of vocabulary.forbidden) {
      expect(blob.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  it("locks registry-honest Proof: arbitrary PC acceptance is Hypothesis", () => {
    expect(proof.hypotheses.some((h) => h.id === "sterile-disk")).toBe(true);
    const factBlob = proof.facts.map((f) => f.body).join("\n").toLowerCase();
    expect(factBlob).toMatch(/реестр|0 ₽|x86_64/);
    expect(factBlob).not.toMatch(/приёмка на произвольном/i);
    expect(proof.airGapCaption.toLowerCase()).toMatch(/not_ready|сзи|luks/i);
    expect(proof.facts.find((f) => f.id === "sandbox")?.title).toMatch(/архитектур/i);
  });
});
