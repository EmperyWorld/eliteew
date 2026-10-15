/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Build Keycloak admin console URLs for operator deep links from Users hub.
 *
 * Invariants:
 * - Realm path segment is `empery` (see documentation/platform/docker-re_doc/KEYCLOAK-ELITEEW.md).
 *
 * Related:
 * - `pages/Admin/AdminUserDetailPanel.tsx`
 * - `pages/Admin/UnifiedAdminPage.tsx` (System section)
 */

const KEYCLOAK_USERS_CONSOLE_BASE =
	'https://auth.eliteew.ru/admin/master/console/#/empery/users';

/** Open realm users list; optional search prefills Keycloak user search when supported. */
export function keycloakUsersConsoleSearchUrl(query: string): string {
	const q = query.trim();
	if (!q) return KEYCLOAK_USERS_CONSOLE_BASE;
	return `${KEYCLOAK_USERS_CONSOLE_BASE}?search=${encodeURIComponent(q)}`;
}
