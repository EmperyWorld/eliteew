/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for cross-app draft lifecycle tone and recovery helpers.
 */

import { describe, expect, it } from 'vitest';

import {
	crossAppDraftHandoffSuccessI18nKey,
	crossAppDraftKindI18nKey,
	crossAppDraftLifecycleI18nKey,
	crossAppDraftLifecycleTone,
	crossAppDraftNeedsRecovery,
	countStaleCrossAppDraftLinks,
	mergeCrossAppDraftLink,
	resolveCrossAppDraftArtifactTitle,
	resolveCrossAppDraftPropertyId,
	resolveCrossAppDraftStaleCheckPropertyId,
	resolveCrossAppDraftStaleHint,
} from './crossAppDraftLifecycleLogic';
import { makeCrossAppDraftLink } from './professionalWorldsTestFixtures';

const baseLink = makeCrossAppDraftLink({
	id: '11111111-1111-4111-8111-111111111111',
	artifact_id: '33333333-3333-4333-8333-333333333333',
});

describe('crossAppDraftLifecycleLogic', () => {
	it('maps lifecycle states to UI tone', () => {
		expect(crossAppDraftLifecycleTone('created')).toBe('neutral');
		expect(crossAppDraftLifecycleTone('opened')).toBe('active');
		expect(crossAppDraftLifecycleTone('stale')).toBe('warning');
		expect(crossAppDraftLifecycleTone('cancelled')).toBe('muted');
	});

	it('detects recovery when stale flags are set', () => {
		expect(crossAppDraftNeedsRecovery(baseLink)).toBe(false);
		expect(crossAppDraftNeedsRecovery({ ...baseLink, is_stale: true })).toBe(
			true
		);
		expect(
			crossAppDraftNeedsRecovery({
				...baseLink,
				lifecycle_state: 'cancelled',
			})
		).toBe(true);
		expect(
			crossAppDraftNeedsRecovery({
				...baseLink,
				stale_reason: 'property_digest_mismatch',
			})
		).toBe(true);
	});

	it('resolves i18n keys for lifecycle and destinations', () => {
		expect(crossAppDraftLifecycleI18nKey('opened')).toBe(
			'crossAppDrafts.lifecycle.opened'
		);
		expect(crossAppDraftLifecycleI18nKey('')).toBe(
			'crossAppDrafts.lifecycle.created'
		);
		expect(crossAppDraftKindI18nKey('site-studio')).toBe(
			'crossAppDrafts.destinations.siteStudio'
		);
	});

	it('merges refreshed link rows by id', () => {
		const refreshed = {
			...baseLink,
			lifecycle_state: 'opened',
			updated_at: '2026-06-21T11:00:00Z',
		};
		const other = {
			...baseLink,
			id: '44444444-4444-4444-8444-444444444444',
		};
		expect(mergeCrossAppDraftLink([baseLink, other], refreshed)).toEqual([
			refreshed,
			other,
		]);
		expect(mergeCrossAppDraftLink([other], refreshed)).toEqual([
			refreshed,
			other,
		]);
	});

	it('resolves artifact title for link rows', () => {
		expect(
			resolveCrossAppDraftArtifactTitle(baseLink, [
				{ id: baseLink.artifact_id ?? '', title: 'Listing pitch' },
			])
		).toBe('Listing pitch');
		expect(resolveCrossAppDraftArtifactTitle(baseLink, [])).toBeNull();
	});

	it('resolves property id and stale-check context from link payload', () => {
		expect(
			resolveCrossAppDraftPropertyId({
				external_ref: {
					property: { property_id: '55555555-5555-4555-8555-555555555555' },
				},
			})
		).toBe('55555555-5555-4555-8555-555555555555');
		expect(resolveCrossAppDraftStaleCheckPropertyId('  p1  ')).toBe('p1');
		expect(resolveCrossAppDraftStaleCheckPropertyId(null)).toBeUndefined();
	});

	it('maps server stale reasons to localized hint keys', () => {
		const translate = (key: string) =>
			key === 'crossAppDrafts.staleReasonPropertyChanged'
				? 'Listing facts changed'
				: key;
		expect(
			resolveCrossAppDraftStaleHint(
				{
					...baseLink,
					stale_reason: 'Property facts changed after draft creation',
				},
				translate
			)
		).toBe('Listing facts changed');
	});

	it('counts stale links and maps handoff success copy keys', () => {
		expect(
			countStaleCrossAppDraftLinks([baseLink, { ...baseLink, is_stale: true }])
		).toBe(1);
		expect(crossAppDraftHandoffSuccessI18nKey('ewrp', true)).toBe(
			'integrationHandoff.openedDestinationEwrp'
		);
		expect(crossAppDraftHandoffSuccessI18nKey('ewrp', false)).toBe(
			'integrationHandoff.draftSaved'
		);
	});
});
