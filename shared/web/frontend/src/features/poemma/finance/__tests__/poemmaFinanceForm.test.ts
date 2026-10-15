/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for finance form helpers (P-201, P-204).
 */

import { describe, expect, it } from 'vitest';
import {
	buildPoemmaFinanceSourceBadge,
	computePoemmaProfitPlanSummary,
	financeNumbersToInputs,
	hasPoemmaMarketplaceFlag,
	isPoemmaFinanceOwner,
	mergePoemmaFinanceManualSave,
	POEMMA_MARKETPLACE_DEFAULT_NOTE,
	resolvePoemmaMarketplaceNote,
	validatePoemmaFinanceDraft,
} from '../poemmaFinanceForm';

describe('poemmaFinanceForm', () => {
	it('scopes owner-only finance edit', () => {
		expect(isPoemmaFinanceOwner('owner')).toBe(true);
		expect(isPoemmaFinanceOwner('team')).toBe(false);
		expect(isPoemmaFinanceOwner('manager')).toBe(false);
	});

	it('builds manual and 1c source badges with date', () => {
		expect(
			buildPoemmaFinanceSourceBadge('manual', '2026-06-03T12:00:00.000Z')
		).toMatch(/^вручную · /);
		expect(
			buildPoemmaFinanceSourceBadge('1c', '2026-06-03T12:00:00.000Z')
		).toMatch(/^из 1С · /);
	});

	it('requires profit greater than zero', () => {
		expect(
			validatePoemmaFinanceDraft({ profitInput: '', revenueInput: '' })
		).toBe('Укажите прибыль больше нуля');
		expect(
			validatePoemmaFinanceDraft({ profitInput: '0', revenueInput: '100' })
		).toBe('Укажите прибыль больше нуля');
		expect(
			validatePoemmaFinanceDraft({ profitInput: '500 000', revenueInput: '' })
		).toBeNull();
	});

	it('computes plan fact percent and status', () => {
		const below = computePoemmaProfitPlanSummary(
			{
				periodId: 'p1',
				primaryMetricType: 'profit',
				primaryMetricLabel: 'Прибыль',
				targetProfit: 1_000_000,
			},
			{
				id: 'f1',
				periodId: 'p1',
				profit: 400_000,
				source: 'manual',
				confidence: 'fact',
				syncedAt: '2026-06-03',
			}
		);
		expect(below.percent).toBe(40);
		expect(below.status).toBe('below');
		expect(below.statusLabel).toBe('Ниже плана');

		const ok = computePoemmaProfitPlanSummary(
			{
				periodId: 'p1',
				primaryMetricType: 'profit',
				primaryMetricLabel: 'Прибыль',
				targetProfit: 500_000,
			},
			{
				id: 'f1',
				periodId: 'p1',
				profit: 600_000,
				source: 'manual',
				confidence: 'fact',
				syncedAt: '2026-06-03',
			}
		);
		expect(ok.status).toBe('ok');
		expect(ok.statusLabel).toBe('План идём');
	});

	it('prefers server planPercent/planStatus when present', () => {
		const summary = computePoemmaProfitPlanSummary(
			{
				periodId: 'p1',
				primaryMetricType: 'profit',
				primaryMetricLabel: 'Прибыль',
				targetProfit: 1_000_000,
			},
			{
				id: 'f1',
				periodId: 'p1',
				profit: 400_000,
				planPercent: 41,
				planStatus: 'below',
				source: 'manual',
				confidence: 'fact',
				syncedAt: '2026-06-03',
			}
		);
		expect(summary.percent).toBe(41);
		expect(summary.status).toBe('below');
	});

	it('detects marketplace flag from snapshot note', () => {
		expect(hasPoemmaMarketplaceFlag(null)).toBe(false);
		expect(hasPoemmaMarketplaceFlag({ marketplaceNote: '  ' })).toBe(false);
		expect(
			hasPoemmaMarketplaceFlag({
				marketplaceNote: 'Продаём на Ozon',
			})
		).toBe(true);
	});

	it('resolves marketplace note when flag enabled', () => {
		expect(
			resolvePoemmaMarketplaceNote({ enabled: false, note: 'x' })
		).toBeUndefined();
		expect(resolvePoemmaMarketplaceNote({ enabled: true, note: '' })).toBe(
			POEMMA_MARKETPLACE_DEFAULT_NOTE
		);
		expect(
			resolvePoemmaMarketplaceNote({
				enabled: true,
				note: '  Ozon без маржи  ',
			})
		).toBe('Ozon без маржи');
	});

	it('merges manual snapshot with marketplace note', () => {
		const saved = mergePoemmaFinanceManualSave({
			existing: null,
			periodId: 'p1',
			revenue: 2_000_000,
			profit: 500_000,
			marketplaceNote: 'Ozon',
		});
		expect(saved.source).toBe('manual');
		expect(saved.profit).toBe(500_000);
		expect(saved.marketplaceNote).toBe('Ozon');
		expect(saved.periodId).toBe('p1');
	});

	it('maps snapshot numbers back to inputs', () => {
		const inputs = financeNumbersToInputs({
			id: 'f1',
			periodId: 'p1',
			revenue: 1_000_000,
			profit: 200_000,
			marketplaceNote: POEMMA_MARKETPLACE_DEFAULT_NOTE,
			source: 'manual',
			confidence: 'fact',
			syncedAt: '2026-06-03',
		});
		expect(inputs.revenueInput).toBe('1000000');
		expect(inputs.profitInput).toBe('200000');
		expect(inputs.marketplaceEnabled).toBe(true);
		expect(inputs.marketplaceNote).toBe('');
	});
});
