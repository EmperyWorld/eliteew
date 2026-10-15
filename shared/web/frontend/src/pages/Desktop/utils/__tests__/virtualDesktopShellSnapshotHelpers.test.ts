/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for virtual-desktop hydrate helpers vs windows_snapshot.
 */

import { describe, expect, it } from 'vitest';
import {
	countWindowsInShellSnapshot,
	liveWindowIdsFromWindowsSnapshot,
	shouldDeferLegacyVirtualDesktopMembership,
	totalVirtualDesktopMembershipIds,
} from '../virtualDesktopShellSnapshotHelpers';

describe('liveWindowIdsFromWindowsSnapshot', () => {
	it('returns ids when snapshot windows include id field', () => {
		expect(
			liveWindowIdsFromWindowsSnapshot({
				windows: [{ id: 'w-a' }, { id: 'w-b' }, { id: 'w-a' }],
			})
		).toEqual(['w-a', 'w-b']);
	});

	it('returns empty array for snapshot without ids', () => {
		expect(
			liveWindowIdsFromWindowsSnapshot({
				windows: [{ type: 'app', title: 'Legacy' }],
			})
		).toEqual([]);
	});
});

describe('shouldDeferLegacyVirtualDesktopMembership', () => {
	it('flags orphan drift when membership far exceeds snapshot size', () => {
		const desktops = [
			{
				id: 'desktop-1',
				windows: Array.from({ length: 40 }, (_, i) => `w-old-${i}`),
			},
		];
		expect(
			shouldDeferLegacyVirtualDesktopMembership(desktops, {
				windows: [{ type: 'app' }, { type: 'app' }],
			})
		).toBe(true);
		expect(totalVirtualDesktopMembershipIds(desktops)).toBe(40);
		expect(countWindowsInShellSnapshot({ windows: [{}, {}] })).toBe(2);
	});
});
