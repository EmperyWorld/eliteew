/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral contract for useVoiceCommandHistory — device-local persistence hook.
 *
 * Invariants:
 * - isLocalOnly is always true; prepend respects MAX_PERSISTED_HISTORY cap.
 *
 * Related:
 * - `useVoiceCommandHistory.ts`, `storage.ts`
 */

import { act, renderHook } from '@testing-library/react';
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
import { useVoiceCommandHistory } from '../useVoiceCommandHistory';

describe('useVoiceCommandHistory', () => {
	afterEach(() => {
		localStorage.clear();
	});

	it('exposes isLocalOnly true (no cloud sync contract)', () => {
		const { result } = renderHook(() => useVoiceCommandHistory());
		expect(result.current.isLocalOnly).toBe(true);
	});

	it('prepends items and persists to localStorage', () => {
		const { result } = renderHook(() => useVoiceCommandHistory());

		act(() => {
			result.current.prependCommandHistoryItem({
				id: 'cmd-a',
				transcript: 'hello desk',
				status: 'success',
				timestamp: new Date('2026-06-30T10:00:00.000Z'),
			});
		});

		expect(result.current.commandHistory).toHaveLength(1);
		expect(result.current.commandHistory[0]?.transcript).toBe('hello desk');
		expect(localStorage.getItem(HISTORY_STORAGE_KEY)).toContain('hello desk');
	});

	it('caps in-memory history at MAX_PERSISTED_HISTORY', () => {
		const { result } = renderHook(() => useVoiceCommandHistory());

		act(() => {
			for (let i = 0; i < MAX_PERSISTED_HISTORY + 3; i += 1) {
				result.current.prependCommandHistoryItem({
					id: `cmd-${i}`,
					transcript: `line ${i}`,
					status: 'success',
					timestamp: new Date(
						`2026-06-30T10:00:${String(i).padStart(2, '0')}.000Z`
					),
				});
			}
		});

		expect(result.current.commandHistory).toHaveLength(MAX_PERSISTED_HISTORY);
		expect(result.current.commandHistory[0]?.transcript).toBe(
			`line ${MAX_PERSISTED_HISTORY + 2}`
		);
	});
});
