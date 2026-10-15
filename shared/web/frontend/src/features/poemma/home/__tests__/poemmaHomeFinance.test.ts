import { describe, expect, it } from 'vitest';
import {
	formatPoemmaHomeSourceBadge,
	getPoemmaHomeProfitProgressBarWidth,
	getPoemmaHomeProfitProgressPercent,
	getPoemmaHomeProfitStatusLabel,
	resolvePoemmaHomeProfitPlanStatus,
} from '../poemmaHomeFinance';

describe('poemmaHomeFinance', () => {
	describe('resolvePoemmaHomeProfitPlanStatus', () => {
		it('returns no_data when profit fact is missing', () => {
			expect(resolvePoemmaHomeProfitPlanStatus(undefined, 1_500_000)).toBe(
				'no_data'
			);
			expect(resolvePoemmaHomeProfitPlanStatus(null, 1_500_000)).toBe(
				'no_data'
			);
		});

		it('returns no_plan when target is missing or zero', () => {
			expect(resolvePoemmaHomeProfitPlanStatus(1_240_000, undefined)).toBe(
				'no_plan'
			);
			expect(resolvePoemmaHomeProfitPlanStatus(1_240_000, 0)).toBe('no_plan');
		});

		it('returns below when fact is under plan', () => {
			expect(resolvePoemmaHomeProfitPlanStatus(1_240_000, 1_500_000)).toBe(
				'below'
			);
		});

		it('returns on_plan when fact meets or exceeds plan', () => {
			expect(resolvePoemmaHomeProfitPlanStatus(1_500_000, 1_500_000)).toBe(
				'on_plan'
			);
			expect(resolvePoemmaHomeProfitPlanStatus(1_600_000, 1_500_000)).toBe(
				'on_plan'
			);
		});
	});

	describe('getPoemmaHomeProfitStatusLabel', () => {
		it('uses COPY-RU strings with at most eight words', () => {
			expect(getPoemmaHomeProfitStatusLabel('below')).toBe('Ниже плана');
			expect(getPoemmaHomeProfitStatusLabel('on_plan')).toBe('План идём');
			expect(getPoemmaHomeProfitStatusLabel('no_data')).toBe('Нет данных');
			expect(getPoemmaHomeProfitStatusLabel('no_plan')).toBeNull();
		});

		it('keeps status labels within eight words', () => {
			for (const status of ['below', 'on_plan', 'no_data'] as const) {
				const label = getPoemmaHomeProfitStatusLabel(status);
				expect(label).not.toBeNull();
				if (!label) {
					throw new Error('Status label must exist');
				}
				expect(label.split(/\s+/).length).toBeLessThanOrEqual(8);
			}
		});
	});

	describe('getPoemmaHomeProfitProgressPercent', () => {
		it('computes rounded percent when plan exists', () => {
			expect(getPoemmaHomeProfitProgressPercent(1_240_000, 1_500_000)).toBe(83);
		});

		it('returns null without a valid plan', () => {
			expect(
				getPoemmaHomeProfitProgressPercent(1_240_000, undefined)
			).toBeNull();
		});
	});

	describe('getPoemmaHomeProfitProgressBarWidth', () => {
		it('caps bar fill at 100', () => {
			expect(getPoemmaHomeProfitProgressBarWidth(120)).toBe(100);
			expect(getPoemmaHomeProfitProgressBarWidth(83)).toBe(83);
		});
	});

	describe('formatPoemmaHomeSourceBadge', () => {
		it('formats 1C source with sync date', () => {
			expect(
				formatPoemmaHomeSourceBadge('1c', '2026-06-01T12:00:00.000Z')
			).toMatch(/^из 1С · \d{2}\.\d{2}\.\d{4}$/);
		});
	});
});
