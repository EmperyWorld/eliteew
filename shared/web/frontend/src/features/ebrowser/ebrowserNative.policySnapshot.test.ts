/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock policy snapshot TTL stamp = client receive time (not server fetched_at).
 *
 * Related:
 * - features/ebrowser/ebrowserNative.ts
 * - documentation/product/desktop/DESKTOP-EBROWSER.md
 */

import { describe, expect, it } from 'vitest';
import { policyApiToSnapshot } from './ebrowserNative';

describe('policyApiToSnapshot', () => {
	it('stamps fetchedAtMs from receive time, not server fetched_at', () => {
		const receive = Date.UTC(2026, 8, 9, 12, 0, 0);
		const serverSkewedBehind = '2026-09-09T02:00:00.000Z';
		const snap = policyApiToSnapshot(
			{
				user_id: 'u1',
				mode: 'open',
				allow: [],
				deny: [],
				fetched_at: serverSkewedBehind,
				expires_at: '2026-09-09T02:05:00.000Z',
				ttl_seconds: 300,
				is_default: false,
			},
			receive
		);
		expect(snap.fetchedAtMs).toBe(receive);
		expect(snap.mode).toBe('open');
		expect(snap.ttlSeconds).toBe(300);
	});
});
