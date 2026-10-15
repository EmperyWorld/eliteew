/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * SPA visibility gate for Unified Admin / UGS admin entry points — JWT app-admin roles only.
 *
 * Invariants:
 * - UI grants mirror `require_admin_user` / UGS role set: `admin`, `emperyworld_admin`, `msi`.
 * - Privileged mutations use `emperyworld_admin` only (`require_emperyworld_admin`).
 * - No client-side email allowlist; `UGS_ADMIN_EMAILS` is API break-glass only (`admin_access.py`).
 * - Keycloak realm-management roles do not imply EliteEW application admin access.
 *
 * Related:
 * - shared/api/services/ugs/admin_access.py
 * - shared/api/routers/admin_auth.py
 */

import { getUserInfo } from '../services/authSession';

export interface UgsAdminIdentity {
	role?: string | null;
	email?: string | null;
}

export const UGS_ADMIN_ROLES = new Set(['admin', 'emperyworld_admin', 'msi']);

/**
 * True if any realm or client role grants access to Unified Admin.
 * Used from AuthContext mapping and hasUgsAdminIdentity (live token).
 */
export function rolesIncludeUgsAdminAccess(
	roles: string[] | null | undefined
): boolean {
	if (!roles?.length) {
		return false;
	}
	return roles.some((r) => UGS_ADMIN_ROLES.has(String(r).trim().toLowerCase()));
}

/**
 * Privileged operator role (revoke/purge, professional-worlds mutations).
 * Precedence matches API `get_effective_role_from_payload` / `require_emperyworld_admin`.
 */
export function rolesIncludeEmperyworldAdmin(
	roles: string[] | null | undefined
): boolean {
	if (!roles?.length) {
		return false;
	}
	return roles.some(
		(r) => String(r).trim().toLowerCase() === 'emperyworld_admin'
	);
}

/** Map JWT role list → SPA `User.role` (do not collapse EW admin → admin). */
export function mapTokenRolesToUserRole(
	roles: string[] | null | undefined
): 'admin' | 'emperyworld_admin' | 'emperyworld_member' {
	if (rolesIncludeEmperyworldAdmin(roles)) {
		return 'emperyworld_admin';
	}
	if (rolesIncludeUgsAdminAccess(roles)) {
		return 'admin';
	}
	return 'emperyworld_member';
}

export function hasEmperyworldAdminIdentity(
	user?: UgsAdminIdentity | null
): boolean {
	try {
		const info = getUserInfo();
		if (info && rolesIncludeEmperyworldAdmin(info.roles)) {
			return true;
		}
	} catch {
		// Auth session not initialised (tests / SSR)
	}

	if (!user) {
		return false;
	}

	const role =
		typeof user.role === 'string' ? user.role.trim().toLowerCase() : '';
	return role === 'emperyworld_admin';
}

export function hasUgsAdminIdentity(user?: UgsAdminIdentity | null): boolean {
	try {
		const info = getUserInfo();
		if (info && rolesIncludeUgsAdminAccess(info.roles)) {
			return true;
		}
	} catch {
		// Auth session not initialised (tests / SSR)
	}

	if (!user) {
		return false;
	}

	const role =
		typeof user.role === 'string' ? user.role.trim().toLowerCase() : '';

	return UGS_ADMIN_ROLES.has(role);
}

export function isUgsAdminAuthorized(params: {
	user?: UgsAdminIdentity | null;
	isAuthenticated?: boolean;
	loading?: boolean;
}): boolean {
	if (params.loading) {
		return false;
	}
	if (!params.isAuthenticated) {
		return false;
	}

	return hasUgsAdminIdentity(params.user);
}
