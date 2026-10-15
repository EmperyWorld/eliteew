/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UX mirror of server Poemma role-PATCH ACL (owner or platform admin only).
 *
 * Invariants:
 * - Must not grant the DEV role switcher to team members; server returns 403.
 *
 * Related:
 * - api/services/poemma_service.py (can_poemma_actor_change_role)
 * - documentation/product/desktop/DESKTOP-API-AND-APPS.md
 */

import type { PoemmaUserRole } from './poemmaDomain';

export function canChangePoemmaRoleOnServer(params: {
	poemmaRole: PoemmaUserRole;
	platformRole: string | null | undefined;
}): boolean {
	if (params.poemmaRole === 'owner') {
		return true;
	}
	const platform = String(params.platformRole ?? '')
		.trim()
		.toLowerCase();
	return platform === 'admin' || platform === 'emperyworld_admin';
}
