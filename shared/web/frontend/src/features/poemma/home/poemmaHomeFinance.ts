/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Home block A — profit plan vs fact helpers (P-203, P-205).
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframe-home.md §5
 * - poemma/docs/implementation/COPY-RU.md (profit.below, profit.ok)
 */

import type { PoemmaDataSource } from '../poemmaDomain';

export type PoemmaHomeProfitPlanStatus =
	| 'below'
	| 'on_plan'
	| 'no_data'
	| 'no_plan';

const POEMMA_HOME_PROFIT_STATUS_LABELS: Record<
	Exclude<PoemmaHomeProfitPlanStatus, 'no_plan'>,
	string
> = {
	below: 'Ниже плана',
	on_plan: 'План идём',
	no_data: 'Нет данных',
};

const POEMMA_HOME_SOURCE_LABELS: Record<PoemmaDataSource, string> = {
	'1c': 'из 1С',
	manual: 'вручную',
	import: 'импорт',
};

export function formatPoemmaHomeMoneyRub(value: number): string {
	return new Intl.NumberFormat('ru-RU', {
		style: 'currency',
		currency: 'RUB',
		maximumFractionDigits: 0,
	}).format(value);
}

export function formatPoemmaHomeSyncDate(syncedAt: string): string {
	return new Intl.DateTimeFormat('ru-RU', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
	}).format(new Date(syncedAt));
}

export function formatPoemmaHomeSourceBadge(
	source: PoemmaDataSource,
	syncedAt: string
): string {
	return `${POEMMA_HOME_SOURCE_LABELS[source]} · ${formatPoemmaHomeSyncDate(syncedAt)}`;
}

export function resolvePoemmaHomeProfitPlan(
	plan: number | null | undefined
): number | null {
	if (plan == null || !Number.isFinite(plan) || plan <= 0) {
		return null;
	}
	return plan;
}

export function resolvePoemmaHomeProfitFact(
	fact: number | null | undefined
): number | null {
	if (fact == null || !Number.isFinite(fact)) {
		return null;
	}
	return fact;
}

/**
 * Plan vs fact status for block A (≤8 words per COPY-RU / wireframe §5).
 */
export function resolvePoemmaHomeProfitPlanStatus(
	fact: number | null | undefined,
	plan: number | null | undefined
): PoemmaHomeProfitPlanStatus {
	const resolvedFact = resolvePoemmaHomeProfitFact(fact);
	const resolvedPlan = resolvePoemmaHomeProfitPlan(plan);

	if (resolvedFact == null) {
		return 'no_data';
	}
	if (resolvedPlan == null) {
		return 'no_plan';
	}
	if (resolvedFact >= resolvedPlan) {
		return 'on_plan';
	}
	return 'below';
}

export function getPoemmaHomeProfitStatusLabel(
	status: PoemmaHomeProfitPlanStatus
): string | null {
	if (status === 'no_plan') {
		return null;
	}
	return POEMMA_HOME_PROFIT_STATUS_LABELS[status];
}

/** Progress 0–100+; null when plan is missing or invalid. */
export function getPoemmaHomeProfitProgressPercent(
	fact: number | null | undefined,
	plan: number | null | undefined
): number | null {
	const resolvedFact = resolvePoemmaHomeProfitFact(fact);
	const resolvedPlan = resolvePoemmaHomeProfitPlan(plan);
	if (resolvedFact == null || resolvedPlan == null) {
		return null;
	}
	return Math.round((resolvedFact / resolvedPlan) * 100);
}

/** Bar fill width caps at 100% for CSS layout. */
export function getPoemmaHomeProfitProgressBarWidth(percent: number): number {
	return Math.min(100, Math.max(0, percent));
}
