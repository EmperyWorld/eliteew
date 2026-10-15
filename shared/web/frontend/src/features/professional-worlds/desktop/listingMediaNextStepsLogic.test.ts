/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for listing media next-step suggestions.
 */

import { describe, expect, it } from 'vitest';

import { resolveListingMediaNextSteps } from './listingMediaNextStepsLogic';

describe('listingMediaNextStepsLogic', () => {
	it('returns empty when no property or media studio disabled', () => {
		expect(
			resolveListingMediaNextSteps({
				hasSelectedProperty: false,
				mediaStudioEnabled: true,
				propertyArtifactCount: 2,
				siteStudioHandoffEnabled: true,
			})
		).toEqual([]);
	});

	it('includes handoff when artifacts and site integration exist', () => {
		expect(
			resolveListingMediaNextSteps({
				hasSelectedProperty: true,
				mediaStudioEnabled: true,
				propertyArtifactCount: 1,
				siteStudioHandoffEnabled: true,
			})
		).toEqual([
			'openListingWorkspace',
			'openBrandStarters',
			'openResultsHandoff',
		]);
	});
});
