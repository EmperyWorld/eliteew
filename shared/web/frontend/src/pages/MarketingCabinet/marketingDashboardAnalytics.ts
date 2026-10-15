/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Dashboard `analytics` block from GET .../dashboard?include=series (marketing cabinet).
 * Kept separate from `marketingCabinetApi.ts` so API params/types can evolve in parallel.
 *
 * Invariants:
 * - `series` / `points` stay optional to match OpenAPI `MarketingDashboardAnalytics` /
 *   `DashboardAnalyticsSeries` (generated marketing-cabinet-openapi).
 * - Chart widgets must treat missing series as `[]` (already via `?? []`).
 *
 * Related:
 * - documentation/product/marketing/MARKETING-CABINET.md § dashboard series
 * - generated/marketing-cabinet-openapi.ts
 */

export const MARKETING_DASHBOARD_SERIES_METRIC_KEYS = [
	'tasks_completed_daily',
	'alerts_opened_daily',
	'ai_runs_started_daily',
] as const;

export type MarketingDashboardSeriesMetricKey =
	(typeof MARKETING_DASHBOARD_SERIES_METRIC_KEYS)[number];

export function isMarketingDashboardSeriesMetricKey(
	key: string
): key is MarketingDashboardSeriesMetricKey {
	return (MARKETING_DASHBOARD_SERIES_METRIC_KEYS as readonly string[]).includes(
		key
	);
}

export interface MarketingDashboardTimeSeriesPoint {
	date: string;
	value: number;
}

export interface MarketingDashboardAnalyticsSeries {
	key: MarketingDashboardSeriesMetricKey | string;
	/** OpenAPI optional — empty/missing when a metric key has no buckets yet. */
	points?: MarketingDashboardTimeSeriesPoint[];
}

export interface MarketingDashboardAnalytics {
	/** Present when `include=series`; OpenAPI marks the field optional. */
	series?: MarketingDashboardAnalyticsSeries[];
	generated_at: string;
	window_days: number;
}
