/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shell SSOT for which desktop window apps require elevated access before mount,
 * and how to resolve loading / allowed / denied for the shell permission gate.
 *
 * Invariants:
 * - Unlisted appComponents are allowed (default deny only for registered restricted apps).
 * - UGS admin check mirrors `isUgsAdminAuthorized` / JWT admin roles — no email allowlist.
 *
 * Related:
 * - `DesktopShellRestrictedAppGate.tsx`
 * - `utils/ugsAdminAccess.ts`
 * - documentation/product/desktop/ELITEEW-UX-PRIMITIVES-CONTRACT.md
 */

import {
	isUgsAdminAuthorized,
	type UgsAdminIdentity,
} from '@/utils/ugsAdminAccess';

/** Apps that must not mount interior UI until shell confirms UGS admin. */
export const DESKTOP_UGS_ADMIN_REQUIRED_APP_COMPONENTS = new Set<string>([
	'UnifiedAdminApp',
]);

export type DesktopRestrictedAppAccessStatus = 'allowed' | 'loading' | 'denied';

export function desktopAppRequiresUgsAdmin(
	appComponent: string | null | undefined
): boolean {
	if (!appComponent) return false;
	return DESKTOP_UGS_ADMIN_REQUIRED_APP_COMPONENTS.has(appComponent);
}

export function resolveDesktopRestrictedAppAccess(params: {
	appComponent: string | null | undefined;
	user?: UgsAdminIdentity | null;
	isAuthenticated?: boolean;
	loading?: boolean;
}): DesktopRestrictedAppAccessStatus {
	if (!desktopAppRequiresUgsAdmin(params.appComponent)) {
		return 'allowed';
	}
	if (params.loading) {
		return 'loading';
	}
	return isUgsAdminAuthorized({
		user: params.user,
		isAuthenticated: params.isAuthenticated,
		loading: false,
	})
		? 'allowed'
		: 'denied';
}
