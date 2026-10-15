import { describe, expect, it } from 'vitest';
import {
	buildPoemmaHomeAlignmentChecklist,
	POEMMA_HOME_ALIGNMENT_TOTAL,
	summarizePoemmaHomeAlignment,
} from '../poemmaHomeAlignment';

describe('poemmaHomeAlignment', () => {
	it('returns five checklist items with expected labels', () => {
		const items = buildPoemmaHomeAlignmentChecklist({
			strategy: {},
			goal: {},
			segments: [],
			period: null,
		});

		expect(items).toHaveLength(POEMMA_HOME_ALIGNMENT_TOTAL);
		expect(items.map((item) => item.label)).toEqual([
			'Стратегия',
			'УТП',
			'Цель',
			'Сегменты',
			'Период',
		]);
	});

	it('marks strategy when vision and mission are filled', () => {
		const items = buildPoemmaHomeAlignmentChecklist({
			strategy: { vision: 'Видение', mission: 'Миссия', utp: '' },
			goal: {},
			segments: [],
			period: null,
		});

		expect(items.find((item) => item.key === 'strategy')?.done).toBe(true);
		expect(items.find((item) => item.key === 'utp')?.done).toBe(false);
	});

	it('marks segments when shares total 100', () => {
		const items = buildPoemmaHomeAlignmentChecklist({
			strategy: {},
			goal: {},
			segments: [
				{ id: 's1', orgId: 'org', name: 'Локальные', sharePercent: 60 },
				{ id: 's2', orgId: 'org', name: 'Туристы', sharePercent: 40 },
			],
			period: null,
		});

		expect(items.find((item) => item.key === 'segments')?.done).toBe(true);
	});

	it('marks period when status is active', () => {
		const items = buildPoemmaHomeAlignmentChecklist({
			strategy: {},
			goal: {},
			segments: [],
			period: {
				id: 'p1',
				orgId: 'org',
				startDate: '2026-03-01',
				endDate: '2026-05-30',
				status: 'active',
			},
		});

		expect(items.find((item) => item.key === 'period')?.done).toBe(true);
	});

	it('summarizes done count', () => {
		const items = buildPoemmaHomeAlignmentChecklist({
			strategy: { vision: 'V', mission: 'M', utp: 'УТП' },
			goal: {
				periodId: 'p1',
				primaryMetricType: 'profit',
				primaryMetricLabel: 'Прибыль',
				targetProfit: 1_000_000,
			},
			segments: [{ id: 's1', orgId: 'org', name: 'A', sharePercent: 100 }],
			period: {
				id: 'p1',
				orgId: 'org',
				startDate: '2026-03-01',
				endDate: '2026-05-30',
				status: 'active',
			},
		});

		expect(summarizePoemmaHomeAlignment(items)).toEqual({
			done: 5,
			total: 5,
		});
	});
});
