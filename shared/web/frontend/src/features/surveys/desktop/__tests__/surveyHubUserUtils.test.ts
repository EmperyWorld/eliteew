/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */
import { describe, expect, it } from 'vitest';
import {
	sortAvailableSurveysByDeadline,
	sortCompletedSurveysByDate,
	surveyDeadlineSortKey,
	surveyCompletedSortKey,
} from '../surveyHubUserUtils';

describe('surveyDeadlineSortKey', () => {
	const now = Date.parse('2026-07-01T12:00:00Z');

	it('ranks sooner deadlines before later ones', () => {
		const soon = surveyDeadlineSortKey('2026-07-02T12:00:00Z', now);
		const later = surveyDeadlineSortKey('2026-07-10T12:00:00Z', now);
		expect(soon).toBeLessThan(later);
	});

	it('puts missing deadline last', () => {
		const withDeadline = surveyDeadlineSortKey('2026-07-05T12:00:00Z', now);
		const without = surveyDeadlineSortKey(null, now);
		expect(withDeadline).toBeLessThan(without);
	});

	it('puts expired deadlines after open ones', () => {
		const open = surveyDeadlineSortKey('2026-07-05T12:00:00Z', now);
		const expired = surveyDeadlineSortKey('2026-06-20T12:00:00Z', now);
		expect(open).toBeLessThan(expired);
	});
});

describe('sortAvailableSurveysByDeadline', () => {
	const now = Date.parse('2026-07-01T12:00:00Z');

	it('orders soonest active deadline first, no-deadline last', () => {
		const items = [
			{ id: 'c', title: 'C', closes_at: null },
			{ id: 'a', title: 'A', closes_at: '2026-07-10T12:00:00Z' },
			{ id: 'b', title: 'B', closes_at: '2026-07-03T12:00:00Z' },
		];
		const sorted = sortAvailableSurveysByDeadline(items, now);
		expect(sorted.map((s) => s.id)).toEqual(['b', 'a', 'c']);
	});
});

describe('sortCompletedSurveysByDate', () => {
	it('orders newest completion first', () => {
		const items = [
			{ id: 'old', title: 'Old', completed_at: '2026-06-01T12:00:00Z' },
			{ id: 'new', title: 'New', completed_at: '2026-07-01T12:00:00Z' },
		];
		const sorted = sortCompletedSurveysByDate(items);
		expect(sorted.map((s) => s.id)).toEqual(['new', 'old']);
	});

	it('supports oldest-first order', () => {
		const items = [
			{ id: 'old', title: 'Old', completed_at: '2026-06-01T12:00:00Z' },
			{ id: 'new', title: 'New', completed_at: '2026-07-01T12:00:00Z' },
		];
		const sorted = sortCompletedSurveysByDate(items, 'oldest');
		expect(sorted.map((s) => s.id)).toEqual(['old', 'new']);
	});
});

describe('surveyCompletedSortKey', () => {
	it('returns zero for missing date', () => {
		expect(surveyCompletedSortKey(null)).toBe(0);
	});
});
