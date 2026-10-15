/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for Admin settings subgroup resolver.
 */

import { describe, expect, it } from 'vitest';

import {
	groupSettingsBySubgroup,
	resolveEwaSettingsSubgroup,
} from '@/features/ewa/admin/ewaCompanionSettingsSubgroups';

describe('ewaCompanionSettingsSubgroups', () => {
	it('maps agentic think keys', () => {
		expect(
			resolveEwaSettingsSubgroup('agentic', 'EWA_AGENTIC_THINK_NUM_PREDICT')
		).toBe('think');
	});

	it('maps media reaper keys', () => {
		expect(
			resolveEwaSettingsSubgroup(
				'media',
				'EWA_COMPANION_PRESENTATION_STALE_REAPER_ENABLED'
			)
		).toBe('reapers');
	});

	it('groups rows preserving subgroup order', () => {
		const groups = groupSettingsBySubgroup([
			{
				setting_key: 'EWA_AGENTIC_CONDENSE_NUM_PREDICT',
				category: 'agentic',
			},
			{ setting_key: 'EWA_AGENTIC_THINK_NUM_PREDICT', category: 'agentic' },
			{ setting_key: 'EWA_UNKNOWN_FLAG', category: 'agentic' },
		]);
		expect(groups.map((g) => g.subgroup)).toEqual([
			'think',
			'condense',
			'other',
		]);
	});
});
