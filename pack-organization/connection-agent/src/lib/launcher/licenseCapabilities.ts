/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Persist redeem/import license capability flags across FoFline/desktop-client restarts.
 *
 * Invariants:
 * - Never stores license_key plaintext.
 * - Fail-open on storage errors (returns null / no-op).
 * - allow_fofline defaults fail-closed when missing.
 *
 * Related:
 * - bindSession.ts (bind ids)
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §4 / W2
 */

export const LICENSE_CAPABILITIES_STORAGE_KEY =
	'eliteew.desktopClient.licenseCapabilities.v1';

export type PersistedLicenseCapabilities = {
	licenseId: string | null;
	allowOffline: boolean | null;
	allowOnline: boolean | null;
	allowFofline: boolean | null;
};

function readRaw(): unknown {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(LICENSE_CAPABILITIES_STORAGE_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as unknown;
	} catch {
		return null;
	}
}

export function readPersistedLicenseCapabilities(): PersistedLicenseCapabilities | null {
	const raw = readRaw();
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const o = raw as Record<string, unknown>;
	const licenseId =
		typeof o.licenseId === 'string' && o.licenseId.trim()
			? o.licenseId.trim()
			: null;
	const allowOffline =
		typeof o.allowOffline === 'boolean' ? o.allowOffline : null;
	const allowOnline = typeof o.allowOnline === 'boolean' ? o.allowOnline : null;
	const allowFofline =
		typeof o.allowFofline === 'boolean' ? o.allowFofline : null;
	if (
		licenseId == null &&
		allowOffline == null &&
		allowOnline == null &&
		allowFofline == null
	) {
		return null;
	}
	return { licenseId, allowOffline, allowOnline, allowFofline };
}

export function persistLicenseCapabilities(input: {
	licenseId?: string | null;
	allowOffline?: boolean | null;
	allowOnline?: boolean | null;
	allowFofline?: boolean | null;
}): void {
	if (typeof localStorage === 'undefined') return;
	const prev = readPersistedLicenseCapabilities();
	const next: PersistedLicenseCapabilities = {
		licenseId:
			typeof input.licenseId === 'string' && input.licenseId.trim()
				? input.licenseId.trim()
				: (prev?.licenseId ?? null),
		allowOffline:
			typeof input.allowOffline === 'boolean'
				? input.allowOffline
				: (prev?.allowOffline ?? null),
		allowOnline:
			typeof input.allowOnline === 'boolean'
				? input.allowOnline
				: (prev?.allowOnline ?? null),
		allowFofline:
			typeof input.allowFofline === 'boolean'
				? input.allowFofline
				: (prev?.allowFofline ?? null),
	};
	try {
		localStorage.setItem(
			LICENSE_CAPABILITIES_STORAGE_KEY,
			JSON.stringify(next)
		);
	} catch {
		/* fail-open */
	}
}

/** Journey W5a — clear persisted redeem capability flags. */
export function clearPersistedLicenseCapabilities(): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.removeItem(LICENSE_CAPABILITIES_STORAGE_KEY);
	} catch {
		/* fail-open */
	}
}
