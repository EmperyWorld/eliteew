/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for Poemma finance / profit tab (P-201, P-204).
 *
 * Invariants:
 * - Manual save requires profit > 0.
 * - Source badge: «вручную · дата» or «из 1С · дата» (COPY-RU).
 * - marketplaceNote marks «прибыль с маркетплейса не видна» when set.
 * - Prefer server planPercent/planStatus on snapshot when present.
 *
 * Related:
 * - poemma/docs/architecture/marketing-cabinet-wireframes.md §6.1
 * - poemma/docs/implementation/COPY-RU.md
 * - documentation/product/desktop/DESKTOP-API-AND-APPS.md
 */

import type {
	PoemmaDataSource,
	PoemmaFinanceSnapshot,
	PoemmaPeriodGoal,
	PoemmaUserRole,
} from '../poemmaDomain';

export const POEMMA_MARKETPLACE_FLAG_LABEL = 'Прибыль с маркетплейса не видна';

export const POEMMA_MARKETPLACE_DEFAULT_NOTE =
	'Продаём на маркетплейсе, прибыль в отчёте не видна';

export type PoemmaProfitPlanStatus = 'empty' | 'below' | 'ok';

export type PoemmaProfitPlanSummary = {
	plan: number | null;
	fact: number | null;
	percent: number | null;
	status: PoemmaProfitPlanStatus;
	statusLabel: string;
};

export function isPoemmaFinanceOwner(role: PoemmaUserRole): boolean {
	return role === 'owner';
}

export function parsePoemmaMoneyInput(raw: string): number | null {
	const normalized = raw.replace(/\s/g, '').replace(',', '.');
	if (!normalized) {
		return null;
	}
	const value = Number(normalized);
	return Number.isFinite(value) ? value : null;
}

export function formatPoemmaFinanceMoneyRub(value: number): string {
	return new Intl.NumberFormat('ru-RU', {
		style: 'currency',
		currency: 'RUB',
		maximumFractionDigits: 0,
	}).format(value);
}

export function formatPoemmaFinanceBadgeDate(syncedAt: string): string {
	const datePart = syncedAt.slice(0, 10);
	return new Intl.DateTimeFormat('ru-RU', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
	}).format(new Date(`${datePart}T00:00:00.000Z`));
}

/** Бейдж источника: «вручную · 03.06.2026» / «из 1С · 03.06.2026». */
export function buildPoemmaFinanceSourceBadge(
	source: PoemmaDataSource,
	syncedAt: string
): string {
	const dateLabel = formatPoemmaFinanceBadgeDate(syncedAt);
	if (source === '1c') {
		return `из 1С · ${dateLabel}`;
	}
	return `вручную · ${dateLabel}`;
}

export function hasPoemmaMarketplaceFlag(
	snapshot: Pick<PoemmaFinanceSnapshot, 'marketplaceNote'> | null
): boolean {
	return !!snapshot?.marketplaceNote?.trim();
}

export function resolvePoemmaMarketplaceNote(input: {
	enabled: boolean;
	note: string;
}): string | undefined {
	if (!input.enabled) {
		return undefined;
	}
	const trimmed = input.note.trim();
	return trimmed || POEMMA_MARKETPLACE_DEFAULT_NOTE;
}

export function validatePoemmaFinanceDraft(input: {
	profitInput: string;
	revenueInput: string;
}): string | null {
	const profit = parsePoemmaMoneyInput(input.profitInput);
	if (profit == null || profit <= 0) {
		return 'Укажите прибыль больше нуля';
	}

	const revenueRaw = input.revenueInput.trim();
	if (revenueRaw) {
		const revenue = parsePoemmaMoneyInput(revenueRaw);
		if (revenue == null || revenue < 0) {
			return 'Проверьте выручку';
		}
	}

	return null;
}

export function computePoemmaProfitPlanSummary(
	goal: PoemmaPeriodGoal | null,
	snapshot: PoemmaFinanceSnapshot | null
): PoemmaProfitPlanSummary {
	const plan =
		goal?.targetProfit != null && goal.targetProfit > 0
			? goal.targetProfit
			: null;
	const fact =
		snapshot?.profit != null && snapshot.profit > 0 ? snapshot.profit : null;

	const serverStatus = snapshot?.planStatus;
	const serverPercent = snapshot?.planPercent;
	if (
		serverStatus === 'empty' ||
		serverStatus === 'below' ||
		serverStatus === 'ok'
	) {
		return {
			plan,
			fact,
			percent:
				typeof serverPercent === 'number' && Number.isFinite(serverPercent)
					? serverPercent
					: null,
			status: serverStatus,
			statusLabel:
				serverStatus === 'empty'
					? 'Нет цифр из 1С'
					: serverStatus === 'below'
						? 'Ниже плана'
						: 'План идём',
		};
	}

	if (fact == null) {
		return {
			plan,
			fact: null,
			percent: null,
			status: 'empty',
			statusLabel: 'Нет цифр из 1С',
		};
	}

	if (plan == null) {
		return {
			plan: null,
			fact,
			percent: null,
			status: 'ok',
			statusLabel: 'План идём',
		};
	}

	const percent = Math.round((fact / plan) * 100);
	const status: PoemmaProfitPlanStatus = fact >= plan ? 'ok' : 'below';
	return {
		plan,
		fact,
		percent,
		status,
		statusLabel: status === 'below' ? 'Ниже плана' : 'План идём',
	};
}

export function buildPoemmaFinanceSnapshotId(): string {
	return `finance-${globalThis.crypto.randomUUID()}`;
}

export function mergePoemmaFinanceManualSave(input: {
	existing: PoemmaFinanceSnapshot | null;
	periodId: string;
	revenue: number | undefined;
	profit: number;
	marketplaceNote: string | undefined;
}): PoemmaFinanceSnapshot {
	const syncedAt = new Date().toISOString();
	return {
		id: input.existing?.id ?? buildPoemmaFinanceSnapshotId(),
		periodId: input.periodId,
		revenue: input.revenue,
		profit: input.profit,
		salesUnits: input.existing?.salesUnits,
		marketplaceNote: input.marketplaceNote,
		source: 'manual',
		confidence: 'fact',
		syncedAt,
	};
}

export function financeNumbersToInputs(
	snapshot: PoemmaFinanceSnapshot | null
): {
	revenueInput: string;
	profitInput: string;
	marketplaceEnabled: boolean;
	marketplaceNote: string;
} {
	if (!snapshot) {
		return {
			revenueInput: '',
			profitInput: '',
			marketplaceEnabled: false,
			marketplaceNote: '',
		};
	}

	const hasFlag = hasPoemmaMarketplaceFlag(snapshot);
	const note = snapshot.marketplaceNote?.trim() ?? '';

	return {
		revenueInput:
			snapshot.revenue != null && snapshot.revenue > 0
				? String(snapshot.revenue)
				: '',
		profitInput:
			snapshot.profit != null && snapshot.profit > 0
				? String(snapshot.profit)
				: '',
		marketplaceEnabled: hasFlag,
		marketplaceNote:
			hasFlag && note !== POEMMA_MARKETPLACE_DEFAULT_NOTE ? note : '',
	};
}
