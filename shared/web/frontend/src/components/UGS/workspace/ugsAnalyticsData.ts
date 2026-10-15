/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure transforms for UGS Analytics charts and breakdown tables.
 *
 * Invariants:
 * - Rows with zero total are omitted from chart/table output.
 *
 * Related:
 * - pages/UGSAnalytics.tsx
 */

import { humanizeUgsTypeKey } from '@/utils/ugsHumanizeTypeKey';

export interface UgsAnalyticsTypeInput {
	type_key?: string | null;
	successful?: number | null;
	failed?: number | null;
	total?: number | null;
}

export interface UgsTypeBreakdownRow {
	typeKey: string;
	label: string;
	successful: number;
	failed: number;
	total: number;
	successRate: number | null;
}

export interface UgsStackedChartRow {
	typeKey: string;
	label: string;
	successful: number;
	failed: number;
	total: number;
}

export interface UgsErrorDistributionRow {
	errorType: string;
	count: number;
}

export function resolveUgsTypeLabel(
	typeKey: string,
	displayNameByKey: ReadonlyMap<string, string>
): string {
	const fromCatalog = displayNameByKey.get(typeKey)?.trim();
	if (fromCatalog) {
		return fromCatalog;
	}
	return humanizeUgsTypeKey(typeKey);
}

export function buildTypeBreakdownRows(
	byType: readonly UgsAnalyticsTypeInput[],
	displayNameByKey: ReadonlyMap<string, string>
): UgsTypeBreakdownRow[] {
	return byType
		.map((row) => {
			const typeKey = String(row.type_key ?? '').trim();
			if (!typeKey) {
				return null;
			}
			const successful = Math.max(0, Number(row.successful ?? 0) || 0);
			const failed = Math.max(0, Number(row.failed ?? 0) || 0);
			const explicitTotal = Number(row.total);
			const total =
				Number.isFinite(explicitTotal) && explicitTotal > 0
					? Math.floor(explicitTotal)
					: successful + failed;
			if (total <= 0) {
				return null;
			}
			const successRate = total > 0 ? successful / total : null;
			return {
				typeKey,
				label: resolveUgsTypeLabel(typeKey, displayNameByKey),
				successful,
				failed,
				total,
				successRate,
			};
		})
		.filter((row): row is UgsTypeBreakdownRow => row !== null)
		.sort((a, b) => b.total - a.total);
}

export function buildStackedChartRows(
	rows: readonly UgsTypeBreakdownRow[],
	limit = 12
): UgsStackedChartRow[] {
	return rows.slice(0, limit).map((row) => ({
		typeKey: row.typeKey,
		label: row.label,
		successful: row.successful,
		failed: row.failed,
		total: row.total,
	}));
}

export function formatSuccessRatePercent(
	rate: number | null | undefined
): string {
	if (rate == null || !Number.isFinite(rate)) {
		return '—';
	}
	return `${Math.round(Math.max(0, Math.min(1, rate)) * 100)}%`;
}

export function parseErrorDistribution(
	items: readonly Record<string, unknown>[]
): UgsErrorDistributionRow[] {
	return items
		.map((item) => {
			const errorType = String(
				item.error_type ?? item.errorType ?? 'unknown'
			).trim();
			const count = Math.max(0, Number(item.count ?? 0) || 0);
			if (!errorType || count <= 0) {
				return null;
			}
			return { errorType, count };
		})
		.filter((row): row is UgsErrorDistributionRow => row !== null)
		.sort((a, b) => b.count - a.count);
}
