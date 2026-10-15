/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for pending reload delay helpers (plan 15 R03).
 */

import { describe, expect, it } from 'vitest';

import {
	COMPANION_PENDING_RELOAD_DELAY_MS,
	shouldShowCompanionPendingReloadDelay,
} from '@/features/ewa/companionUx/companionPendingReloadDelay';

describe('shouldShowCompanionPendingReloadDelay', () => {
	it('shows banner only when pending without stream past threshold', () => {
		expect(
			shouldShowCompanionPendingReloadDelay(
				true,
				'',
				COMPANION_PENDING_RELOAD_DELAY_MS
			)
		).toBe(true);
		expect(
			shouldShowCompanionPendingReloadDelay(
				true,
				'tokens',
				COMPANION_PENDING_RELOAD_DELAY_MS
			)
		).toBe(false);
		expect(
			shouldShowCompanionPendingReloadDelay(
				false,
				'',
				COMPANION_PENDING_RELOAD_DELAY_MS
			)
		).toBe(false);
	});
});
