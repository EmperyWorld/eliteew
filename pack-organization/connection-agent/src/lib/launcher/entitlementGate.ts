/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure gate helpers for offline entitlement vs optional online SPA Start.
 *
 * Invariants:
 * - Cloud/FoFline SPA Start needs version OK + local entitlement OK + server preflight OK.
 * - onlineBoundLabel alone must not bypass expired/revoked license.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
 */

export function canOpenCloudSpa(params: {
	versionOk: boolean;
	entitlementOk: boolean;
	/** @deprecated Masking expired local entitlement — kept for chips only; Start ignores. */
	onlineBoundSession?: boolean;
	/** When not true, cloud Start is disabled (offline-only / unset). */
	allowOnline?: boolean | null;
	/** Server license/preflight ok (required for online seats). */
	preflightOk?: boolean;
}): boolean {
	if (params.allowOnline !== true) {
		return false;
	}
	if (!params.versionOk || !params.entitlementOk) {
		return false;
	}
	return params.preflightOk === true;
}

/** FoFline Start — requires allow_fofline + local entitlement + server preflight. */
export function canOpenFoflineSpa(params: {
	versionOk: boolean;
	entitlementOk: boolean;
	onlineBoundSession?: boolean;
	allowFofline?: boolean | null;
	preflightOk?: boolean;
}): boolean {
	if (params.allowFofline !== true) {
		return false;
	}
	if (!params.versionOk || !params.entitlementOk) {
		return false;
	}
	return params.preflightOk === true;
}

export function offlineShellReady(entitlementOk: boolean): boolean {
	return entitlementOk;
}
