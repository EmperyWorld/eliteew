/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Local factory-reset contracts: inventory, result evaluation, revoke forbid list.
 *
 * Invariants:
 * - Reset is local-only; never server revoke / edge peer cancel.
 * - failed includes entitlement|bind|peer → no success UI.
 * - Keep device_identity, WebKit markers, Import folder, RPM/NSIS.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §5.3
 */

export type LicenseLocalResetResult = {
	ok: boolean;
	cleared: string[];
	skipped: string[];
	failed: string[];
	requires_restart: boolean;
};

/** Critical path keys that must clear or fail closed (W5a). */
export const CRITICAL_RESET_STEPS = [
	'w_transport_stop',
	'entitlement',
	'bind',
	'peer',
	'fe_local_storage',
	'app_restart',
] as const;

/** Extended path (W5b). */
export const EXTENDED_RESET_STEPS = [
	'fofline_spa',
	'denylist',
	'product_webview',
	'clipboard_history',
	'notifications_inbox',
	'ai_third_party',
] as const;

/** Must survive local reset. */
export const RESET_KEEP = [
	'device_identity',
	'webkit_graphics_markers',
	'import_folder',
	'installed_package',
] as const;

export const CRITICAL_FAIL_KEYS = ['entitlement', 'bind', 'peer'] as const;

/**
 * Forbidden FE/Core HTTP path fragments for wipe orchestrator (local-only HARD).
 */
export const FORBIDDEN_REVOKE_PATH_FRAGMENTS = [
	'/license/revoke',
	'/licenses/revoke',
	'/seat/revoke',
	'/entitlement/revoke',
	'/admin/license/delete',
	'/desktop/seats/delete',
] as const;

export function resetAllowsSuccessUi(
	result: LicenseLocalResetResult
): boolean {
	if (!result.ok) return false;
	if (!result.requires_restart) return false;
	for (const key of CRITICAL_FAIL_KEYS) {
		if (result.failed.includes(key)) return false;
	}
	return true;
}

/** Idempotent clean device: ok with empty failed even if already cleared. */
export function isIdempotentCleanReset(
	result: LicenseLocalResetResult
): boolean {
	return (
		result.ok &&
		result.failed.length === 0 &&
		result.requires_restart === true
	);
}

export function urlLooksLikeServerRevoke(url: string): boolean {
	const u = url.toLowerCase();
	return FORBIDDEN_REVOKE_PATH_FRAGMENTS.some((frag) =>
		u.includes(frag.toLowerCase())
	);
}

export function wipeConfirmAllowsUninstallCheckbox(flags: {
	showUninstall: boolean;
}): boolean {
	// Journey v1: no uninstall-with-license checkbox.
	return flags.showUninstall === false;
}
