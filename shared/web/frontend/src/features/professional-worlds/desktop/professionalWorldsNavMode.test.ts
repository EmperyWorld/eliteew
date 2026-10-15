/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for compact/full Professional Worlds sidebar filtering.
 *
 * Related:
 * - professionalWorldsNavMode.ts
 */

import { describe, expect, it } from 'vitest';

import {
	deriveNavProgressStage,
	filterNavItemsForMode,
	isViewVisibleInNavMode,
	suggestFullNavMode,
	toggleNavMode,
} from './professionalWorldsNavMode';

describe('professionalWorldsNavMode', () => {
	it('filters sidebar to starter views in compact mode', () => {
		const items = [
			{ id: 'overview' as const, label: 'Overview' },
			{ id: 'brand' as const, label: 'Brand' },
			{ id: 'clients' as const, label: 'Clients' },
		];
		expect(
			filterNavItemsForMode(items, 'compact').map((item) => item.id)
		).toEqual(['overview', 'clients']);
		expect(filterNavItemsForMode(items, 'full')).toHaveLength(3);
	});

	it('suggests full menu after quick-start milestones', () => {
		expect(
			deriveNavProgressStage({
				profileReady: false,
				onboardingComplete: false,
				propertiesCount: 0,
			})
		).toBe('firstRun');
		expect(
			deriveNavProgressStage({
				profileReady: true,
				onboardingComplete: false,
				propertiesCount: 0,
			})
		).toBe('midProgress');
		expect(
			deriveNavProgressStage({
				profileReady: true,
				onboardingComplete: true,
				propertiesCount: 1,
			})
		).toBe('complete');
		expect(
			suggestFullNavMode({
				profileReady: true,
				onboardingComplete: true,
				propertiesCount: 1,
			})
		).toBe(true);
		expect(
			suggestFullNavMode({
				profileReady: false,
				onboardingComplete: true,
				propertiesCount: 1,
			})
		).toBe(false);
	});

	it('toggles compact and full modes', () => {
		expect(toggleNavMode('compact')).toBe('full');
		expect(toggleNavMode('full')).toBe('compact');
	});

	it('hides advanced views in compact mode', () => {
		expect(isViewVisibleInNavMode('artifacts', 'compact')).toBe(false);
		expect(isViewVisibleInNavMode('artifacts', 'full')).toBe(true);
	});
});
