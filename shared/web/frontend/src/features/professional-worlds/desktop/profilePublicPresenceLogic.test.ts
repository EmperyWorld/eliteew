/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for profile public presence wizard helpers.
 */

import { describe, expect, it } from 'vitest';

import {
	buildProfilePublicPresenceCapsule,
	countProfileBasicsProgress,
	isProfilePublicPresenceReady,
	isProfilePublicPresenceStepDone,
	resolveProfilePublicPresenceSteps,
} from './profilePublicPresenceLogic';
import type { SpecialistProfileUpsert } from './types';

const profile: SpecialistProfileUpsert = {
	vertical_slug: 'realtor',
	display_name: 'Anna Realtor',
	city: 'Vladivostok',
	headline: 'Sea-view expert',
	agency_name: 'North Agency',
	specialization: [],
	profile_data: {},
	is_public_ready: false,
};

describe('profilePublicPresenceLogic', () => {
	it('lists missing profile fields before preview step', () => {
		expect(
			resolveProfilePublicPresenceSteps({
				...profile,
				display_name: '',
				headline: '',
			})
		).toEqual(['name', 'headline', 'preview']);
	});

	it('builds a Site Studio capsule from profile fields', () => {
		const capsule = buildProfilePublicPresenceCapsule(profile);
		expect(capsule.destination).toBe('site_studio');
		expect(capsule.property?.title_hint).toBe('Anna Realtor');
		expect(capsule.presentation?.outline_markdown).toContain('Sea-view expert');
	});

	it('requires name and city before opening preview', () => {
		expect(isProfilePublicPresenceReady(profile)).toBe(true);
		expect(isProfilePublicPresenceReady({ ...profile, city: '' })).toBe(false);
	});

	it('counts filled profile basics for progress hint', () => {
		expect(countProfileBasicsProgress(profile)).toEqual({
			filled: 4,
			total: 4,
		});
		expect(
			countProfileBasicsProgress({ ...profile, display_name: '', headline: '' })
		).toEqual({ filled: 2, total: 4 });
	});

	it('marks checklist steps done from profile fields', () => {
		expect(isProfilePublicPresenceStepDone('name', profile)).toBe(true);
		expect(
			isProfilePublicPresenceStepDone('preview', { ...profile, city: '' })
		).toBe(false);
	});
});
