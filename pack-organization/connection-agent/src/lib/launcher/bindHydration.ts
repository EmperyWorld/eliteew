/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve license/device ids for Start URL after boot, import, or redeem (#015).
 *
 * Invariants:
 * - Prefer explicit session bind, then entitlement blob, then persisted local ids.
 * - Empty strings treated as missing.
 *
 * Related:
 * - lib/launcher/productStart.ts
 * - lib/launcher/bindSession.ts
 */

export type BindIdSource = {
	license_id?: string | null;
	device_id?: string | null;
};

export type PersistedBindIds = {
	licenseId?: string | null;
	deviceId?: string | null;
};

export type ResolvedStartBind = {
	licenseId: string | null;
	deviceId: string | null;
};

function trimOrNull(raw: string | null | undefined): string | null {
	const t = (raw || '').trim();
	return t ? t : null;
}

/** Merge bind sources for product Start URL query params. */
export function resolveStartBindIds(opts: {
	bindLicenseId?: string | null;
	bindDeviceId?: string | null;
	entitlement?: BindIdSource | null;
	persisted?: PersistedBindIds | null;
}): ResolvedStartBind {
	const licenseId =
		trimOrNull(opts.bindLicenseId) ??
		trimOrNull(opts.entitlement?.license_id) ??
		trimOrNull(opts.persisted?.licenseId);
	const deviceId =
		trimOrNull(opts.bindDeviceId) ??
		trimOrNull(opts.entitlement?.device_id) ??
		trimOrNull(opts.persisted?.deviceId);
	return { licenseId, deviceId };
}

/** Values to apply into React bind state after entitlement load/import. */
export function bindPatchFromEntitlement(
	ent: BindIdSource | null | undefined
): { licenseId?: string; deviceId?: string } {
	const licenseId = trimOrNull(ent?.license_id);
	const deviceId = trimOrNull(ent?.device_id);
	const out: { licenseId?: string; deviceId?: string } = {};
	if (licenseId) out.licenseId = licenseId;
	if (deviceId) out.deviceId = deviceId;
	return out;
}
