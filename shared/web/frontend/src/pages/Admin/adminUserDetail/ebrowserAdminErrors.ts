/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map EBrowser policy validation / API error codes to admin i18n keys.
 *
 * Related:
 * - pages/Admin/adminUserDetail/AdminUserDetailEbrowserTab.tsx
 * - shared/api/services/ebrowser/nav_policy.py
 */

const KNOWN_CODES = new Set([
	'open_mode_lists_forbidden',
	'allowlist_deny_forbidden',
	'denylist_allow_forbidden',
	'denylist_empty_forbidden',
	'invalid_mode',
	'invalid_entry',
]);

export function ebrowserAdminValidationCode(raw: string): string | null {
	const code = raw.trim();
	if (!code) return null;
	if (KNOWN_CODES.has(code)) return code;
	// FastAPI detail may be JSON-ish or prefixed
	const match = /([a-z_]+_forbidden|invalid_mode|invalid_entry)/.exec(code);
	return match && KNOWN_CODES.has(match[1]) ? match[1] : null;
}

export function ebrowserAdminErrorI18nKey(raw: string): string {
	const code = ebrowserAdminValidationCode(raw);
	if (code) {
		return `adminUserDetail.ebrowser.errors.${code}`;
	}
	return 'adminUserDetail.ebrowser.saveFailed';
}
