/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit locks for contemplation presence mode helpers (Continuity W2 FE).
 *
 * Invariants:
 * - Default mode is chat; merge is shallow and preserves sibling LP keys.
 *
 * Related:
 * - src/services/ewa/ewaCompanionProfileApi.ts
 */

import { describe, expect, it } from 'vitest';

import {
	EWA_COMPANION_PRESENCE_PREF_KEY,
	mergeEwaCompanionPresenceModePref,
	readEwaCompanionPresenceMode,
} from '@/services/ewa/ewaCompanionProfileApi';

describe('ewaCompanionPresenceMode', () => {
	it('defaults to chat', () => {
		expect(readEwaCompanionPresenceMode(undefined)).toBe('chat');
		expect(readEwaCompanionPresenceMode({})).toBe('chat');
	});

	it('reads contemplation from LP blob', () => {
		expect(
			readEwaCompanionPresenceMode({
				[EWA_COMPANION_PRESENCE_PREF_KEY]: { mode: 'contemplation' },
			})
		).toBe('contemplation');
	});

	it('merges mode without dropping sibling keys', () => {
		const merged = mergeEwaCompanionPresenceModePref(
			{ keep: true, [EWA_COMPANION_PRESENCE_PREF_KEY]: { mode: 'chat', x: 1 } },
			'contemplation'
		);
		expect(merged.keep).toBe(true);
		expect(merged[EWA_COMPANION_PRESENCE_PREF_KEY]).toMatchObject({
			mode: 'contemplation',
			x: 1,
		});
	});
});
