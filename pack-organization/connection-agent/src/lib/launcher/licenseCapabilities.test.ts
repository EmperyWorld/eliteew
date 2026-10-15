/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Narrow lock: FoFline allow_fofline survives cold restart via localStorage.
 *
 * Related:
 * - licenseCapabilities.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	LICENSE_CAPABILITIES_STORAGE_KEY,
	persistLicenseCapabilities,
	readPersistedLicenseCapabilities,
} from './licenseCapabilities';

function installMemoryLocalStorage(): void {
	const store = new Map<string, string>();
	vi.stubGlobal('localStorage', {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => {
			store.set(k, String(v));
		},
		removeItem: (k: string) => {
			store.delete(k);
		},
		clear: () => {
			store.clear();
		},
		key: (i: number) => Array.from(store.keys())[i] ?? null,
		get length() {
			return store.size;
		},
	});
}

describe('licenseCapabilities', () => {
	beforeEach(() => {
		installMemoryLocalStorage();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('round-trips allowFofline for cold boot restore', () => {
		persistLicenseCapabilities({
			licenseId: '11111111-1111-1111-1111-111111111111',
			allowOnline: true,
			allowFofline: true,
		});
		const got = readPersistedLicenseCapabilities();
		expect(got?.allowFofline).toBe(true);
		expect(got?.allowOnline).toBe(true);
		expect(got?.licenseId).toBe('11111111-1111-1111-1111-111111111111');
		expect(localStorage.getItem(LICENSE_CAPABILITIES_STORAGE_KEY)).toBeTruthy();
	});

	it('merges partial updates without wiping allowFofline', () => {
		persistLicenseCapabilities({ allowFofline: true, allowOnline: true });
		persistLicenseCapabilities({ allowOnline: false });
		const got = readPersistedLicenseCapabilities();
		expect(got?.allowFofline).toBe(true);
		expect(got?.allowOnline).toBe(false);
	});

	it('returns null when storage empty', () => {
		expect(readPersistedLicenseCapabilities()).toBeNull();
	});
});
