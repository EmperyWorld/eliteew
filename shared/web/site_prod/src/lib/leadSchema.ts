/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Zod contract for POST /api/lead (quiz + single intents + combined bundle).
 *
 * Invariants:
 * - Email required; phone optional; intent must match CTA ladder.
 * - Bundle requires interests[] (demo/poc/roi/tco_table), min 1.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md
 */

import { z } from "zod";

export const leadInterestSchema = z.enum([
  "demo",
  "poc",
  "roi",
  "tco_table",
]);

export const leadIntentSchema = z.enum([
  "quiz",
  "demo",
  "poc",
  "roi",
  "tco_table",
  "bundle",
]);

export const leadContactSchema = z.object({
  email: z.string().email().max(254),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  companySize: z.enum(["1-99", "100-1000", "1000+"]),
  name: z.string().trim().max(120).optional().or(z.literal("")),
});

export const quizResultsSchema = z.object({
  answers: z.record(z.string(), z.string()),
  score: z.number().int().min(0).max(50),
  risk_profile: z.string().min(1).max(120),
});

export const leadPayloadSchema = z
  .object({
    intent: leadIntentSchema,
    contact: leadContactSchema,
    quiz_results: quizResultsSchema.optional(),
    interests: z.array(leadInterestSchema).min(1).max(4).optional(),
    source: z.string().max(80).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.intent === "bundle") {
      if (!data.interests || data.interests.length < 1) {
        ctx.addIssue({
          code: "custom",
          path: ["interests"],
          message: "interests_required_for_bundle",
        });
      }
    }
  });

export type LeadPayload = z.infer<typeof leadPayloadSchema>;
export type LeadIntent = z.infer<typeof leadIntentSchema>;
export type LeadInterest = z.infer<typeof leadInterestSchema>;
