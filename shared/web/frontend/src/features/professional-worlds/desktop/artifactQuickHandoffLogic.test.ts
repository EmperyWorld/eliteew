/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for Results library one-click handoff destination resolution.
 */

import { describe, expect, it } from 'vitest';

import {
	artifactSupportsQuickHandoff,
	resolveArtifactQuickHandoffActions,
	resolveIntegrationKeyForDraftKind,
} from './artifactQuickHandoffLogic';
import { makeRuntimeIntegration } from './professionalWorldsTestFixtures';
import type {
	ProfessionalArtifact,
	ProfessionalRuntimeIntegration,
} from './types';

const propertyArtifact = {
	id: 'a1',
	source_type: 'realtor_property',
	source_id: 'p1',
} as ProfessionalArtifact;

describe('artifactQuickHandoffLogic', () => {
	it('requires a listing-linked artifact', () => {
		expect(artifactSupportsQuickHandoff(propertyArtifact)).toBe(true);
		expect(
			artifactSupportsQuickHandoff({
				...propertyArtifact,
				source_type: 'coach',
				source_id: null,
			})
		).toBe(false);
	});

	it('returns enabled integrations in stable UX order', () => {
		const integrations: ProfessionalRuntimeIntegration[] = [
			makeRuntimeIntegration({
				id: '1',
				integration_key: 'ewdesk',
				display_name: 'EWDesk',
			}),
			makeRuntimeIntegration({
				id: '2',
				integration_key: 'ewrp',
				display_name: 'EWRP',
			}),
			makeRuntimeIntegration({
				id: '3',
				integration_key: 'site_studio',
				display_name: 'Site Studio',
				is_enabled: false,
			}),
		];
		expect(
			resolveArtifactQuickHandoffActions(integrations).map(
				(item) => item.draftKind
			)
		).toEqual(['ewrp', 'ewdesk']);
	});

	it('resolves integration_key from draft_kind', () => {
		const integrations: ProfessionalRuntimeIntegration[] = [
			makeRuntimeIntegration({
				id: '1',
				integration_key: 'site_studio',
				display_name: 'Site Studio',
			}),
		];
		expect(resolveIntegrationKeyForDraftKind('site-studio', integrations)).toBe(
			'site_studio'
		);
	});
});
