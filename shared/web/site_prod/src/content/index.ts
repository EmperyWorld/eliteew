/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Barrel export for site_prod landing content modules.
 *
 * Invariants:
 * - Single import surface for page sections.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md
 */

export { brand, privacyNotice, privacyPanel, vocabulary } from "./brand";
export { closer } from "./closer";
export { comparison } from "./comparison";
export { contactPack } from "./contact";
export { hero } from "./hero";
export { jobs } from "./jobs";
export { problem } from "./problem";
export { proof } from "./proof";
export { quiz, riskProfiles } from "./quiz";
export { solution } from "./solution";
export type { CtaSpec, LeadIntent } from "./types";
export type { JobRole, JobRoleId } from "./jobs";
