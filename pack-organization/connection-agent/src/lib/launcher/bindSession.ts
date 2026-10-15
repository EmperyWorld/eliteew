/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Persist last successful redeem bind ids in localStorage for cold Start hydration.
 *
 * Invariants:
 * - Never stores license_key plaintext.
 * - Fail-open on storage errors (returns null / no-op).
 *
 * Related:
 * - lib/launcher/bindHydration.ts
 */

import type { PersistedBindIds } from './bindHydration';

export const BIND_LICENSE_STORAGE_KEY =
	'eliteew.desktopClient.bindLicenseId.v1';
export const BIND_DEVICE_STORAGE_KEY = 'eliteew.desktopClient.bindDeviceId.v1';

export function readPersistedBindIds(): PersistedBindIds | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const licenseId = (
			localStorage.getItem(BIND_LICENSE_STORAGE_KEY) || ''
		).trim();
		const deviceId = (
			localStorage.getItem(BIND_DEVICE_STORAGE_KEY) || ''
		).trim();
		if (!licenseId && !deviceId) return null;
		return {
			licenseId: licenseId || null,
			deviceId: deviceId || null,
		};
	} catch {
		return null;
	}
}

export function persistBindIds(licenseId: string, deviceId: string): void {
	if (typeof localStorage === 'undefined') return;
	const lid = licenseId.trim();
	const did = deviceId.trim();
	if (!lid || !did) return;
	try {
		localStorage.setItem(BIND_LICENSE_STORAGE_KEY, lid);
		localStorage.setItem(BIND_DEVICE_STORAGE_KEY, did);
	} catch {
		/* fail-open */
	}
}

/** Journey W5a — clear cold-start bind hydration keys. */
export function clearPersistedBindIds(): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.removeItem(BIND_LICENSE_STORAGE_KEY);
		localStorage.removeItem(BIND_DEVICE_STORAGE_KEY);
	} catch {
		/* fail-open */
	}
}
