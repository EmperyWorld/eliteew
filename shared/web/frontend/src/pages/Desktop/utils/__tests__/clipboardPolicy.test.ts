/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Narrow lock for Cloud Desktop clipboard quarantine vs sync policy.
 *
 * Invariants:
 * - Default normalize → sync.
 * - Quarantine disables OS poll, OS write, and shell_state clipboard sync.
 * - foflineNative defaults to quarantine when storage has no explicit preference.
 *
 * Related:
 * - clipboardPolicy.ts
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
	setOidcRuntimeProfile,
	type OidcRuntimeProfile,
} from '@/services/keycloakProfile';
import {
	allowsOsClipboardPoll,
	allowsOsClipboardWrite,
	allowsShellStateClipboardSync,
	CLIPBOARD_POLICY_STORAGE_KEY,
	normalizeClipboardPolicyMode,
	readClipboardPolicyMode,
	writeClipboardPolicyMode,
} from '../clipboardPolicy';

describe('clipboardPolicy', () => {
	afterEach(() => {
		setOidcRuntimeProfile('web');
	});

	it('defaults unknown values to sync', () => {
		expect(normalizeClipboardPolicyMode(undefined)).toBe('sync');
		expect(normalizeClipboardPolicyMode('nope')).toBe('sync');
		expect(normalizeClipboardPolicyMode('quarantine')).toBe('quarantine');
	});

	it('quarantine disables OS poll, write, and shell_state sync', () => {
		expect(allowsOsClipboardPoll('sync')).toBe(true);
		expect(allowsOsClipboardPoll('quarantine')).toBe(false);
		expect(allowsOsClipboardWrite('sync')).toBe(true);
		expect(allowsOsClipboardWrite('quarantine')).toBe(false);
		expect(allowsShellStateClipboardSync('sync')).toBe(true);
		expect(allowsShellStateClipboardSync('quarantine')).toBe(false);
	});

	it('round-trips policy through storage adapter', () => {
		const mem = new Map<string, string>();
		const storage = {
			getItem: (k: string) => mem.get(k) ?? null,
			setItem: (k: string, v: string) => {
				mem.set(k, v);
			},
		};
		writeClipboardPolicyMode('quarantine', storage);
		expect(mem.get(CLIPBOARD_POLICY_STORAGE_KEY)).toBe('quarantine');
		expect(readClipboardPolicyMode(storage)).toBe('quarantine');
		writeClipboardPolicyMode('sync', storage);
		expect(readClipboardPolicyMode(storage)).toBe('sync');
	});

	it.each([
		['web', 'sync'],
		['desktopNative', 'sync'],
		['foflineNative', 'quarantine'],
	] as const)(
		'%s edition default without stored preference → %s',
		(profile: OidcRuntimeProfile, expected) => {
			setOidcRuntimeProfile(profile);
			const storage = {
				getItem: () => null,
			};
			expect(readClipboardPolicyMode(storage)).toBe(expected);
		}
	);

	it('foflineNative respects explicit sync preference', () => {
		setOidcRuntimeProfile('foflineNative');
		const mem = new Map<string, string>([
			[CLIPBOARD_POLICY_STORAGE_KEY, 'sync'],
		]);
		const storage = {
			getItem: (k: string) => mem.get(k) ?? null,
		};
		expect(readClipboardPolicyMode(storage)).toBe('sync');
	});
});
