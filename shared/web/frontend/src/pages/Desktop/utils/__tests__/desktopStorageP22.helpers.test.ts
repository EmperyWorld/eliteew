/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral locks for P22 extracted desktop storage helpers (merge + delete
 * conflict message + offline full sync skip).
 *
 * Invariants:
 * - Helpers stay free of React hooks.
 *
 * Related:
 * - utils/desktopStorageItemMerge.ts
 * - utils/desktopStorageItemMutations.ts
 * - utils/desktopStorageItemsSync.ts
 */

import { describe, expect, it, vi } from 'vitest';
import {
	dedupeDesktopItemsById,
	mergeDesktopItemsWithDefaults,
} from '../../utils/desktopStorageItemMerge';
import { resolveDesktopDeleteConflictMessage } from '../../utils/desktopStorageItemMutations';
import { syncDesktopItemsFullPut } from '../../utils/desktopStorageItemsSync';
import type { DesktopItem } from '../../types/desktop.types';

function stubItem(
	id: string,
	overrides: Partial<DesktopItem> = {}
): DesktopItem {
	return {
		id,
		name: id,
		type: 'app',
		position: { x: 0, y: 0 },
		isPinned: false,
		children: [],
		...overrides,
	};
}

describe('desktopStorageItemMerge', () => {
	it('dedupes by id keeping first occurrence', () => {
		const a = stubItem('x', { name: 'first' });
		const b = stubItem('x', { name: 'second' });
		const out = dedupeDesktopItemsById([a, b]);
		expect(out).toHaveLength(1);
		expect(out[0]?.name).toBe('first');
	});

	it('mergeDesktopItemsWithDefaults does not invent apps from empty API payload', () => {
		const merged = mergeDesktopItemsWithDefaults([]);
		expect(merged).toEqual([]);
	});
});

describe('resolveDesktopDeleteConflictMessage', () => {
	it('prefers API detail.message over fallback', () => {
		expect(
			resolveDesktopDeleteConflictMessage(
				{ message: 'linked project' },
				'fallback'
			)
		).toBe('linked project');
	});

	it('falls back when detail has no message', () => {
		expect(resolveDesktopDeleteConflictMessage({ code: 409 }, 'fallback')).toBe(
			'fallback'
		);
	});
});

describe('syncDesktopItemsFullPut offline', () => {
	it('skips PUT and does not broadcast when offline', async () => {
		const hasLoaded = { current: true };
		const inFlight = { current: false };
		const queued = { current: null as DesktopItem[] | null };
		const setIsSyncing = vi.fn();
		const setError = vi.fn();
		const broadcast = vi.fn();

		const result = await syncDesktopItemsFullPut({
			listToSend: [stubItem('a')],
			isOnline: false,
			persistSubjectKey: 'subj-1',
			config: null,
			hasLoadedServerSnapshotRef: hasLoaded,
			fullSyncInFlightRef: inFlight,
			queuedFullSyncItemsRef: queued,
			setIsSyncing,
			setError,
			broadcastDesktopMutation: broadcast,
		});

		expect(result.status).toBe('skipped');
		expect(broadcast).not.toHaveBeenCalled();
		expect(setIsSyncing).not.toHaveBeenCalled();
	});
});
