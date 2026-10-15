/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
	SURVEY_HUB_HISTORY_SESSION_KEY,
	clearSurveyHubHistoryPrefs,
	isSurveyHubHistoryFiltersActive,
	persistHistoryNewestFirst,
	persistHistorySearchQuery,
	readHistoryNewestFirst,
	readHistorySearchQuery,
} from '../surveyHubHistorySession';

describe('surveyHubHistorySession', () => {
	afterEach(() => {
		sessionStorage.removeItem(SURVEY_HUB_HISTORY_SESSION_KEY);
	});

	it('defaults to newest first when storage is empty', () => {
		expect(readHistoryNewestFirst()).toBe(true);
	});

	it('returns false when oldest-first was persisted', () => {
		persistHistoryNewestFirst(false);
		expect(readHistoryNewestFirst()).toBe(false);
	});

	it('ignores invalid JSON and falls back to newest first', () => {
		sessionStorage.setItem(SURVEY_HUB_HISTORY_SESSION_KEY, '{bad');
		expect(readHistoryNewestFirst()).toBe(true);
	});

	it('defaults search query to empty string', () => {
		expect(readHistorySearchQuery()).toBe('');
	});

	it('persists and restores search query', () => {
		persistHistorySearchQuery('pulse');
		expect(readHistorySearchQuery()).toBe('pulse');
	});

	it('merges sort and search without clobbering each other', () => {
		persistHistoryNewestFirst(false);
		persistHistorySearchQuery('beta');
		expect(readHistoryNewestFirst()).toBe(false);
		expect(readHistorySearchQuery()).toBe('beta');
	});

	it('detects active filters for search or non-default sort', () => {
		expect(
			isSurveyHubHistoryFiltersActive({
				newestFirst: true,
				searchQuery: '',
			})
		).toBe(false);
		expect(
			isSurveyHubHistoryFiltersActive({
				newestFirst: false,
				searchQuery: '',
			})
		).toBe(true);
		expect(
			isSurveyHubHistoryFiltersActive({
				newestFirst: true,
				searchQuery: 'pulse',
			})
		).toBe(true);
	});

	it('clearSurveyHubHistoryPrefs removes stored prefs', () => {
		persistHistorySearchQuery('pulse');
		persistHistoryNewestFirst(false);
		clearSurveyHubHistoryPrefs();
		expect(sessionStorage.getItem(SURVEY_HUB_HISTORY_SESSION_KEY)).toBeNull();
		expect(readHistorySearchQuery()).toBe('');
		expect(readHistoryNewestFirst()).toBe(true);
	});
});
