/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for EWRP sticky context mismatch helpers.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - `ewrpStickyContextMismatch.ts`
 */

import { describe, expect, it } from 'vitest';
import {
	ewrpStickySlidesMismatch,
	ewrpStickyThemeMismatch,
	normalizeEwrpPresentationThemeId,
	resolveEwrpStatusSlideCount,
} from './ewrpStickyContextMismatch';

describe('normalizeEwrpPresentationThemeId', () => {
	it('maps empty and whitespace to classic', () => {
		expect(normalizeEwrpPresentationThemeId('')).toBe('classic');
		expect(normalizeEwrpPresentationThemeId('   ')).toBe('classic');
		expect(normalizeEwrpPresentationThemeId(undefined)).toBe('classic');
	});

	it('preserves non-empty theme ids', () => {
		expect(normalizeEwrpPresentationThemeId('midnight')).toBe('midnight');
	});
});

describe('resolveEwrpStatusSlideCount', () => {
	it('prefers slides array length', () => {
		expect(
			resolveEwrpStatusSlideCount({ slides: [{}, {}, {}], num_slides: 5 })
		).toBe(3);
	});

	it('falls back to num_slides when slides empty', () => {
		expect(resolveEwrpStatusSlideCount({ slides: [], num_slides: 7 })).toBe(7);
	});

	it('returns null when no countable slides', () => {
		expect(resolveEwrpStatusSlideCount(null)).toBeNull();
		expect(
			resolveEwrpStatusSlideCount({ slides: [], num_slides: 0 })
		).toBeNull();
	});
});

describe('ewrpStickySlidesMismatch', () => {
	it('is false without active job or job count', () => {
		expect(
			ewrpStickySlidesMismatch({
				hasActiveJob: false,
				formNumSlides: 5,
				jobSlideCount: 8,
			})
		).toBe(false);
		expect(
			ewrpStickySlidesMismatch({
				hasActiveJob: true,
				formNumSlides: 5,
				jobSlideCount: null,
			})
		).toBe(false);
	});

	it('detects form vs job slide count drift', () => {
		expect(
			ewrpStickySlidesMismatch({
				hasActiveJob: true,
				formNumSlides: 5,
				jobSlideCount: 8,
			})
		).toBe(true);
		expect(
			ewrpStickySlidesMismatch({
				hasActiveJob: true,
				formNumSlides: 5,
				jobSlideCount: 5,
			})
		).toBe(false);
	});
});

describe('ewrpStickyThemeMismatch', () => {
	it('is false without active job', () => {
		expect(
			ewrpStickyThemeMismatch({
				hasActiveJob: false,
				formTheme: 'classic',
				jobTheme: 'midnight',
			})
		).toBe(false);
	});

	it('treats empty job theme as classic', () => {
		expect(
			ewrpStickyThemeMismatch({
				hasActiveJob: true,
				formTheme: 'classic',
				jobTheme: '',
			})
		).toBe(false);
	});

	it('detects theme drift', () => {
		expect(
			ewrpStickyThemeMismatch({
				hasActiveJob: true,
				formTheme: 'classic',
				jobTheme: 'ember',
			})
		).toBe(true);
	});
});
