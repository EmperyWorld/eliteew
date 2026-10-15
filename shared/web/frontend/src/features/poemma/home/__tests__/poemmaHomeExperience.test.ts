import { describe, expect, it } from 'vitest';
import {
	buildPoemmaHomeExperienceView,
	formatPoemmaHomeNpsLine,
	hasPoemmaHomeExperienceData,
} from '../poemmaHomeExperience';

describe('poemmaHomeExperience', () => {
	it('treats missing scores as empty state', () => {
		const view = buildPoemmaHomeExperienceView({
			balance: {
				orgId: 'org-1',
				employeeScore: 0,
				clientScore: 0,
				measuredAt: '2026-06-01T00:00:00.000Z',
				inBalance: false,
			},
			nps: null,
			thresholdPercent: 5,
		});

		expect(view.mode).toBe('empty');
		expect(view.statusLabel).toBeNull();
		expect(hasPoemmaHomeExperienceData(null)).toBe(false);
	});

	it('shows balance status and score bars when data exists', () => {
		const view = buildPoemmaHomeExperienceView({
			balance: {
				orgId: 'org-1',
				employeeScore: 80,
				clientScore: 78,
				measuredAt: '2026-06-01T00:00:00.000Z',
				inBalance: true,
			},
			nps: {
				id: 'nps-1',
				periodId: 'p1',
				month: '2026-06',
				score: 42,
				responsesCount: 12,
				source: '1c',
			},
			thresholdPercent: 5,
		});

		expect(view.mode).toBe('filled');
		expect(view.statusLabel).toBe('В балансе');
		expect(view.employeeScore).toBe(80);
		expect(view.clientScore).toBe(78);
		expect(view.npsLine).toBe('NPS 42 · из 1С');
	});

	it('marks gap when scores diverge beyond threshold', () => {
		const view = buildPoemmaHomeExperienceView({
			balance: {
				orgId: 'org-1',
				employeeScore: 90,
				clientScore: 50,
				measuredAt: '2026-06-01T00:00:00.000Z',
				inBalance: false,
			},
			nps: null,
			thresholdPercent: 5,
		});

		expect(view.statusLabel).toBe('Есть разрыв');
		expect(view.inBalance).toBe(false);
	});

	it('formats NPS line from manual source', () => {
		expect(
			formatPoemmaHomeNpsLine({
				id: 'nps-2',
				periodId: 'p1',
				month: '2026-06',
				score: 38.6,
				responsesCount: 3,
				source: 'manual',
			})
		).toBe('NPS 39 · вручную');
	});
});
