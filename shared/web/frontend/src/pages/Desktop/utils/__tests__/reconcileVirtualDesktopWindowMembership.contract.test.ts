/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract lock for virtual-desktop window membership reconcile: drop orphans,
 * keep each live id on one desktop, honor restore assignments.
 *
 * Invariants:
 * - Same membership returns the same `desktops` reference.
 *
 * Related:
 * - utils/reconcileVirtualDesktopWindowMembership.ts
 */

import { describe, expect, it } from 'vitest';
import { reconcileVirtualDesktopWindowMembership } from '../reconcileVirtualDesktopWindowMembership';

function desk(
	id: string,
	windows: string[],
	extra: { name?: string; isActive?: boolean } = {}
) {
	return {
		id,
		name: extra.name ?? id,
		isActive: extra.isActive ?? false,
		windows,
	};
}

describe('reconcileVirtualDesktopWindowMembership', () => {
	it('drops orphan ids that are not in the live window set', () => {
		const desktops = [
			desk('desktop-1', ['w-live', 'w-dead-1', 'w-dead-2'], {
				name: 'Безраздельный мир 1',
				isActive: true,
			}),
		];

		const next = reconcileVirtualDesktopWindowMembership({
			desktops,
			liveWindowIds: ['w-live'],
			activeDesktopId: 'desktop-1',
		});

		expect(next).not.toBe(desktops);
		expect(next[0]?.windows).toEqual(['w-live']);
		expect(next[0]?.name).toBe('Безраздельный мир 1');
	});

	it('places unassigned live ids on the active desktop', () => {
		const desktops = [
			desk('desktop-1', [], { isActive: true }),
			desk('desktop-2', []),
		];

		const next = reconcileVirtualDesktopWindowMembership({
			desktops,
			liveWindowIds: ['w-new'],
			activeDesktopId: 'desktop-1',
		});

		expect(next[0]?.windows).toEqual(['w-new']);
		expect(next[1]?.windows).toEqual([]);
	});

	it('honors restore assignments over the active desktop', () => {
		const desktops = [
			desk('desktop-1', ['w-orphan'], { isActive: true }),
			desk('desktop-2', []),
		];

		const next = reconcileVirtualDesktopWindowMembership({
			desktops,
			liveWindowIds: ['w-restored-a', 'w-restored-b'],
			assignments: {
				'w-restored-a': 'desktop-2',
				'w-restored-b': 'desktop-1',
			},
			activeDesktopId: 'desktop-1',
		});

		expect(next[0]?.windows).toEqual(['w-restored-b']);
		expect(next[1]?.windows).toEqual(['w-restored-a']);
	});

	it('keeps a live id on its current desktop when no assignment is given', () => {
		const desktops = [
			desk('desktop-1', [], { isActive: true }),
			desk('desktop-2', ['w-live']),
		];

		const next = reconcileVirtualDesktopWindowMembership({
			desktops,
			liveWindowIds: ['w-live'],
			activeDesktopId: 'desktop-1',
		});

		expect(next[0]?.windows).toEqual([]);
		expect(next[1]?.windows).toEqual(['w-live']);
	});

	it('returns the same desktops reference when membership is already live', () => {
		const desktops = [desk('desktop-1', ['w-a', 'w-b'], { isActive: true })];

		const next = reconcileVirtualDesktopWindowMembership({
			desktops,
			liveWindowIds: ['w-a', 'w-b'],
			activeDesktopId: 'desktop-1',
		});

		expect(next).toBe(desktops);
	});

	it('clears every desktop when the live set is empty', () => {
		const desktops = [
			desk('desktop-1', ['w-1', 'w-2'], { isActive: true }),
			desk('desktop-2', ['w-3']),
		];

		const next = reconcileVirtualDesktopWindowMembership({
			desktops,
			liveWindowIds: [],
			activeDesktopId: 'desktop-1',
		});

		expect(next.map((desktop) => desktop.windows)).toEqual([[], []]);
	});

	it('dedupes a live id that was listed on two desktops', () => {
		const desktops = [
			desk('desktop-1', ['w-dup'], { isActive: true }),
			desk('desktop-2', ['w-dup']),
		];

		const next = reconcileVirtualDesktopWindowMembership({
			desktops,
			liveWindowIds: ['w-dup'],
			activeDesktopId: 'desktop-1',
		});

		expect(next[0]?.windows).toEqual(['w-dup']);
		expect(next[1]?.windows).toEqual([]);
	});
});
