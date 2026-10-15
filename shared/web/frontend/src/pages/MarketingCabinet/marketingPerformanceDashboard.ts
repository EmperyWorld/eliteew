/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed frontend contract for the marketer-facing performance dashboard.
 * HTTP response shapes alias OpenAPI full pilot (Wave 4); request query stays FE.
 *
 * Invariants:
 * - Derived metrics may be null when backend denominators are zero.
 * - Filter values are part of React Query keys and must match backend echo filters.
 *
 * Related:
 * - marketingCabinetApi/marketingCabinetOpenApi.ts
 * - shared/api/schemas/marketing_cabinet/performance.py
 * - documentation/product/marketing/MARKETING-CABINET.md
 */

export type {
	MarketingPerformanceDashboard,
	MarketingPerformanceDashboardFilters,
	MarketingPerformanceDiagnostic,
	MarketingPerformanceTotals,
	MarketingPerformanceCampaign,
	MarketingPerformanceSeriesPoint,
	MarketingPerformanceCohort,
} from './marketingCabinetApi/marketingCabinetOpenApi';

/** FE request shape for performance dashboard query params (camelCase client). */
export interface MarketingPerformanceDashboardRequest {
	dateFrom?: string | null;
	dateTo?: string | null;
	windowDays?: number;
	campaignIds?: string[];
	sources?: string[];
	geos?: string[];
}

export function formatMarketingMoney(value: number | null | undefined): string {
	return new Intl.NumberFormat(undefined, {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 0,
	}).format(value ?? 0);
}

export function formatMarketingRatio(value: number | null | undefined): string {
	return value == null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}

export function formatMarketingPercent(
	value: number | null | undefined
): string {
	return value == null ? 'n/a' : `${value.toFixed(1)}%`;
}
