/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for EWDesk admin bridge sessionStorage helpers.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
	consumeProfessionalWorldsEwDeskAdminDraft,
	stashProfessionalWorldsEwDeskAdminDraft,
} from './professionalWorldsEwDeskAdminBridge';

describe('professionalWorldsEwDeskAdminBridge', () => {
	afterEach(() => {
		sessionStorage.clear();
	});

	it('stashes and consumes draft once', () => {
		expect(
			stashProfessionalWorldsEwDeskAdminDraft({
				title: 'Listing note',
				markdown: 'Body',
				crossAppLinkId: 'link-1',
			})
		).toBe(true);
		expect(consumeProfessionalWorldsEwDeskAdminDraft()).toEqual({
			title: 'Listing note',
			markdown: 'Body',
			crossAppLinkId: 'link-1',
		});
		expect(consumeProfessionalWorldsEwDeskAdminDraft()).toBeNull();
	});
});
