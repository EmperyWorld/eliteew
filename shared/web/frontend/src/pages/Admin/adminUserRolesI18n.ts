/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * i18n role labels for admin Users hub (display + filter chips).
 *
 * Related:
 * - `pages/Admin/adminUserRoles.ts`
 */

import type { TFunction } from 'i18next';

const ROLE_I18N: Record<string, string> = {
	admin: 'adminUsersHub.roles.admin',
	emperyworld_admin: 'adminUsersHub.roles.emperyworldAdmin',
	emperyworld_member: 'adminUsersHub.roles.member',
	brotherhood_member: 'adminUsersHub.roles.member',
	moderator: 'adminUsersHub.roles.moderator',
	ai_agent: 'adminUsersHub.roles.aiAgent',
};

export function adminUserRoleLabelI18n(
	role: string | null | undefined,
	t: TFunction
): string {
	if (!role) return '—';
	const key = ROLE_I18N[role.trim()];
	return key ? t(key) : role;
}
