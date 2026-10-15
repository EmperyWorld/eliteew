/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public UGS service DTO aliases consumed by Hub, Dashboard, and workflow UI.
 *
 * Invariants:
 * - Backend-owned envelopes are sourced from generated `ugs-openapi.ts` aliases via `schemas.ts`.
 * - `GenerationType` is OpenAPI `GenerationTypeResponse` (no invented fields such as `icon`).
 * - `ProvidersSummary` is a documented FE flatten of `UGSProvidersStatusResponse`
 *   (`providers` + `summary.total|healthy|average_response_time`) produced by
 *   `normalizeUgsProvidersSummary` in `dashboard.ts`.
 *
 * Related:
 * - services/api/ugs/schemas.ts
 * - services/api/ugs/dashboard.ts
 * - api/schemas/ugs.py
 * - documentation/api/FRONTEND-BACKEND-HTTP.md §UGS typed contracts / Wave 6
 */

import type {
	UgsBillingStatsSchema,
	UgsGenerationTypeSchema,
	UgsProviderHealthSchema,
	UgsProvidersStatusSummarySchema,
	UgsStatsSchema,
	UgsTaskSchema,
} from './schemas';

export type UGSTask = UgsTaskSchema;

export type UGSStats = UgsStatsSchema;

/** Public catalog row from GET /api/v1/ugs/types (OpenAPI GenerationTypeResponse). */
export type GenerationType = UgsGenerationTypeSchema;

/** Provider health row from OpenAPI UGSProviderHealthRow. */
export type ProviderHealth = UgsProviderHealthSchema;

/**
 * Hub-facing flatten of OpenAPI `UGSProvidersStatusResponse`.
 * Input to the normalizer stays `UgsProvidersStatusSchema`; this view renames
 * `summary.total` → `total_providers` and `summary.healthy` → `healthy_providers`.
 */
export type ProvidersSummary = {
	providers: ProviderHealth[];
	total_providers: UgsProvidersStatusSummarySchema['total'];
	healthy_providers: UgsProvidersStatusSummarySchema['healthy'];
	average_response_time: UgsProvidersStatusSummarySchema['average_response_time'];
};

export type UGSBillingStats = UgsBillingStatsSchema;
