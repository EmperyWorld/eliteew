/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * L4 contractual tests for subject-scoped workspace local cache: no silent wipe,
 * dirty survives “reload”, clear only on explicit logout clear, no cross-subject leak.
 *
 * Invariants:
 * - Uses in-memory localStorage stub; no network.
 *
 * Related:
 * - utils/desktopWorkspaceLocalCache.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopItem } from '../../types/desktop.types';
import {
	DESKTOP_WORKSPACE_LOCAL_CACHE_KEY,
	clearDesktopWorkspaceLocalCache,
	markDesktopWorkspaceItemsDirty,
	peekDesktopWorkspaceLocalCache,
	writeDesktopWorkspaceLocalCache,
} from '../desktopWorkspaceLocalCache';

function memoryLocalStorage(): Storage {
	const map = new Map<string, string>();
	return {
		get length() {
			return map.size;
		},
		clear() {
			map.clear();
		},
		getItem(key: string) {
			return map.has(key) ? (map.get(key) ?? null) : null;
		},
		key(index: number) {
			return [...map.keys()][index] ?? null;
		},
		removeItem(key: string) {
			map.delete(key);
		},
		setItem(key: string, value: string) {
			map.set(key, String(value));
		},
	} as Storage;
}

const sampleItem = (id: string): DesktopItem => ({
	id,
	name: id,
	type: 'app',
	position: { x: 0, y: 0 },
	appComponent: 'AppStore',
});

describe('desktopWorkspaceLocalCache', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', memoryLocalStorage());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('retains dirty items across peek after write (reload simulation)', () => {
		expect(
			writeDesktopWorkspaceLocalCache({
				subject: 'user-a',
				items: [sampleItem('app-1')],
				itemsDirty: true,
			})
		).toBe(true);

		const first = peekDesktopWorkspaceLocalCache('user-a');
		expect(first?.itemsDirty).toBe(true);
		expect(first?.items.map((i) => i.id)).toEqual(['app-1']);

		const second = peekDesktopWorkspaceLocalCache('user-a');
		expect(second?.itemsDirty).toBe(true);
		expect(second?.items).toHaveLength(1);
		expect(
			localStorage.getItem(DESKTOP_WORKSPACE_LOCAL_CACHE_KEY)
		).toBeTruthy();
	});

	it('does not leak envelopes across subjects', () => {
		writeDesktopWorkspaceLocalCache({
			subject: 'user-a',
			items: [sampleItem('a-only')],
			itemsDirty: true,
		});
		writeDesktopWorkspaceLocalCache({
			subject: 'user-b',
			items: [sampleItem('b-only')],
			itemsDirty: false,
		});

		expect(peekDesktopWorkspaceLocalCache('user-a')?.items[0]?.id).toBe(
			'a-only'
		);
		expect(peekDesktopWorkspaceLocalCache('user-b')?.items[0]?.id).toBe(
			'b-only'
		);
		expect(peekDesktopWorkspaceLocalCache('user-a')?.itemsDirty).toBe(true);
		expect(peekDesktopWorkspaceLocalCache('user-b')?.itemsDirty).toBe(false);
	});

	it('clears dirty only via mark / full clear — not by empty boot write omitting subjects', () => {
		writeDesktopWorkspaceLocalCache({
			subject: 'user-a',
			items: [sampleItem('kept')],
			itemsDirty: true,
		});
		markDesktopWorkspaceItemsDirty('user-a', false);
		expect(peekDesktopWorkspaceLocalCache('user-a')?.itemsDirty).toBe(false);
		expect(peekDesktopWorkspaceLocalCache('user-a')?.items[0]?.id).toBe('kept');

		writeDesktopWorkspaceLocalCache({
			subject: 'user-a',
			items: [sampleItem('kept'), sampleItem('extra')],
			itemsDirty: true,
		});
		clearDesktopWorkspaceLocalCache('user-a');
		expect(peekDesktopWorkspaceLocalCache('user-a')).toBeNull();

		writeDesktopWorkspaceLocalCache({
			subject: 'user-b',
			items: [sampleItem('b')],
			itemsDirty: true,
		});
		clearDesktopWorkspaceLocalCache();
		expect(peekDesktopWorkspaceLocalCache('user-b')).toBeNull();
		expect(localStorage.getItem(DESKTOP_WORKSPACE_LOCAL_CACHE_KEY)).toBeNull();
	});

	it('strips React icon fields from serialized items', () => {
		const withIcon = {
			...sampleItem('iconed'),
			icon: () => null,
		} as DesktopItem & { icon: () => null };

		writeDesktopWorkspaceLocalCache({
			subject: 'user-a',
			items: [withIcon],
			itemsDirty: false,
		});

		const raw = localStorage.getItem(DESKTOP_WORKSPACE_LOCAL_CACHE_KEY);
		expect(raw).toBeTruthy();
		expect(raw).not.toContain('"icon"');
		expect(
			peekDesktopWorkspaceLocalCache('user-a')?.items[0]
		).not.toHaveProperty('icon');
	});
});
