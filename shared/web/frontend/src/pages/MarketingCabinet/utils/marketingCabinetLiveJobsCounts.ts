/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Helpers for marketing-cabinet active AI/IMC run counts (rail, badge, poll intervals).
 *
 * Invariants:
 * - Prefer API `total` over `items.length` when list queries use minimal `limit`.
 *
 * Related:
 * - marketingCabinetApi.getProjectLiveJobsSummary
 */
import type { MarketingProjectLiveJobsSummaryParsed } from '../marketingCabinetApi/marketingCabinetApiZod';

export function marketingCabinetActiveRunListCount(
	data: { items?: unknown[]; total?: number } | undefined
): number {
	if (!data) return 0;
	if (typeof data.total === 'number' && Number.isFinite(data.total)) {
		return Math.max(0, data.total);
	}
	return data.items?.length ?? 0;
}

export function marketingCabinetLiveJobsSummaryActiveTotal(
	data: MarketingProjectLiveJobsSummaryParsed | undefined
): number {
	if (!data) return 0;
	return Math.max(0, data.ai_active_total) + Math.max(0, data.imc_active_total);
}

export function marketingCabinetProjectLiveJobsPollIntervalMs(
	data: MarketingProjectLiveJobsSummaryParsed | undefined
): number | false {
	return marketingCabinetLiveJobsSummaryActiveTotal(data) > 0 ? 4500 : false;
}
