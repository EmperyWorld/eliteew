/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for pre-React route normalization and single-tab precedence.
 *
 * Invariants:
 * - OAuth callbacks never enter the minimal follower bundle.
 * - Empty and slash-prefixed Desktop hashes share one classification.
 *
 * Related:
 * - `services/boot/bootRoutePolicy.ts`
 */

import { describe, expect, it } from 'vitest';
import {
	isDesktopBootLocation,
	isOAuthBootCallback,
	normalizeBootHashSegment,
	resolveBootEntryPolicy,
	type BootLocation,
} from '../bootRoutePolicy';

const location = (overrides: Partial<BootLocation> = {}): BootLocation => ({
	pathname: '/',
	search: '',
	hash: '',
	...overrides,
});

describe('bootRoutePolicy', () => {
	it.each(['', '#desktop', '#/desktop', '#desktop/store/apps'])(
		'classifies %s as Desktop',
		(hash) => {
			const current = location({ hash });
			expect(isDesktopBootLocation(current)).toBe(true);
			expect(resolveBootEntryPolicy(current).singleTabEligible).toBe(true);
		}
	);

	it('normalizes query and leading slash without importing runtime routing', () => {
		expect(normalizeBootHashSegment('#/desktop/store?tab=installed')).toBe(
			'desktop/store'
		);
	});

	it.each([
		location({ search: '?code=abc&state=xyz' }),
		location({ hash: '#desktop?code=abc&state=xyz' }),
		location({ hash: '#code=abc&state=xyz' }),
	])('forces OAuth callback through the full entry', (current) => {
		expect(isOAuthBootCallback(current)).toBe(true);
		expect(resolveBootEntryPolicy(current).singleTabEligible).toBe(false);
	});

	it('keeps standalone mobile download outside single-tab election', () => {
		const current = location({ pathname: '/mobile-app/' });
		expect(resolveBootEntryPolicy(current)).toMatchObject({
			route: 'mobile-download',
			singleTabEligible: false,
		});
	});

	it('keeps login and unrelated product routes outside election', () => {
		expect(
			resolveBootEntryPolicy(location({ hash: '#login' })).singleTabEligible
		).toBe(false);
		expect(
			resolveBootEntryPolicy(location({ hash: '#mobile-handbook' }))
				.singleTabEligible
		).toBe(false);
	});
});
