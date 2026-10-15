/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for Voice Command Center localStorage persistence (device-local only).
 *
 * Invariants:
 * - History is capped at MAX_PERSISTED_HISTORY and never implies server sync.
 *
 * Related:
 * - `storage.ts`, `useVoiceCommandHistory.ts`
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
	function createMemoryStorage(): Storage {
		let store: Record<string, string> = {};
		return {
			get length() {
				return Object.keys(store).length;
			},
			clear() {
				store = {};
			},
			getItem(key: string) {
				return store[key] ?? null;
			},
			setItem(key: string, value: string) {
				store[key] = String(value);
			},
			removeItem(key: string) {
				delete store[key];
			},
			key(index: number) {
				return Object.keys(store)[index] ?? null;
			},
		};
	}
	vi.stubGlobal('localStorage', createMemoryStorage());
});

import { HISTORY_STORAGE_KEY, MAX_PERSISTED_HISTORY } from '../types';
import {
	clearPersistedHistory,
	loadPersistedHistory,
	savePersistedHistory,
	VOICE_COMMAND_HISTORY_IS_LOCAL_ONLY,
} from '../storage';

describe('voiceCommand storage offline contract', () => {
	afterEach(() => {
		localStorage.clear();
	});

	it('VOICE_COMMAND_HISTORY_IS_LOCAL_ONLY is permanently true', () => {
		expect(VOICE_COMMAND_HISTORY_IS_LOCAL_ONLY).toBe(true);
	});

	it('loadPersistedHistory returns empty array when key missing', () => {
		expect(loadPersistedHistory()).toEqual([]);
	});

	it('savePersistedHistory round-trips items under HISTORY_STORAGE_KEY', () => {
		const now = new Date('2026-06-30T12:00:00.000Z');
		savePersistedHistory([
			{
				id: 'cmd-1',
				transcript: 'open settings',
				status: 'success',
				timestamp: now,
				commandId: 'open_settings',
			},
		]);

		expect(localStorage.getItem(HISTORY_STORAGE_KEY)).toBeTruthy();
		const loaded = loadPersistedHistory();
		expect(loaded).toHaveLength(1);
		expect(loaded[0]?.transcript).toBe('open settings');
		expect(loaded[0]?.timestamp.toISOString()).toBe(now.toISOString());
	});

	it('savePersistedHistory caps persisted list at MAX_PERSISTED_HISTORY', () => {
		const items = Array.from({ length: MAX_PERSISTED_HISTORY + 5 }, (_, i) => ({
			id: `cmd-${i}`,
			transcript: `phrase ${i}`,
			status: 'success' as const,
			timestamp: new Date(
				`2026-06-30T12:00:${String(i).padStart(2, '0')}.000Z`
			),
		}));
		savePersistedHistory(items);

		const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
		expect(raw).toBeTruthy();
		const parsed = JSON.parse(raw ?? '[]') as unknown[];
		expect(parsed).toHaveLength(MAX_PERSISTED_HISTORY);
	});

	it('loadPersistedHistory ignores corrupt JSON', () => {
		localStorage.setItem(HISTORY_STORAGE_KEY, '{not-json');
		expect(loadPersistedHistory()).toEqual([]);
	});

	it('savePersistedHistory returns false when setItem throws', () => {
		const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
			throw new Error('quota');
		});
		const ok = savePersistedHistory([
			{
				id: 'cmd-1',
				transcript: 'help',
				status: 'success',
				timestamp: new Date(),
			},
		]);
		expect(ok).toBe(false);
		setItem.mockRestore();
	});

	it('clearPersistedHistory removes stored journal', () => {
		savePersistedHistory([
			{
				id: 'cmd-1',
				transcript: 'help',
				status: 'success',
				timestamp: new Date(),
			},
		]);
		clearPersistedHistory();
		expect(localStorage.getItem(HISTORY_STORAGE_KEY)).toBeNull();
	});
});
