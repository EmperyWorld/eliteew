/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared content types for the public site_prod landing (Safe Workspace funnel).
 *
 * Invariants:
 * - Lead intents match documentation/product/SITE-PROD-LANDING.md CTA ladder.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md
 * - /home/owned/site_doc/ (operator briefs, outside git)
 */

export type LeadIntent =
  | "quiz"
  | "demo"
  | "poc"
  | "roi"
  | "tco_table"
  | "bundle";

export type CtaSpec = {
  label: string;
  intent: LeadIntent;
  href: string;
  variant: "primary" | "secondary";
};
