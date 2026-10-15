import { describe, expect, it } from 'vitest';
import {
	buildPoemmaHomeGuideEntryPath,
	buildPoemmaHomeGuideEntries,
	buildPoemmaHomeGuideView,
	findPoemmaHomeTestingInitiative,
} from '../poemmaHomeGuide';

describe('poemmaHomeGuide', () => {
	it('exposes three guide entry buttons with preset paths', () => {
		const entries = buildPoemmaHomeGuideEntries();

		expect(entries).toHaveLength(3);
		expect(entries.map((entry) => entry.label)).toEqual([
			'Нужна стратегия',
			'Нужно УТП',
			'Новый → постоянный',
		]);
		expect(entries.map((entry) => entry.path)).toEqual([
			'/guide?branch=strategy',
			'/guide?branch=utp',
			'/guide?branch=retention',
		]);
	});

	it('builds branch preset path', () => {
		expect(buildPoemmaHomeGuideEntryPath('utp')).toBe('/guide?branch=utp');
	});

	it('prefers testing initiative over entry buttons', () => {
		const view = buildPoemmaHomeGuideView([
			{
				id: 'idea-1',
				periodId: 'p1',
				title: 'Коллаб Приморье',
				story: 'Проверка партнёра',
				status: 'testing',
			},
			{
				id: 'idea-2',
				periodId: 'p1',
				title: 'Другая идея',
				story: '',
				status: 'backlog',
			},
		]);

		expect(view.mode).toBe('testing');
		expect(view.testingInitiative?.title).toBe('Коллаб Приморье');
		expect(findPoemmaHomeTestingInitiative([])).toBeNull();
	});

	it('falls back to guide entries when no testing initiative', () => {
		const view = buildPoemmaHomeGuideView([
			{
				id: 'idea-2',
				periodId: 'p1',
				title: 'Другая идея',
				story: '',
				status: 'backlog',
			},
		]);

		expect(view.mode).toBe('entries');
		expect(view.entries).toHaveLength(3);
	});
});
