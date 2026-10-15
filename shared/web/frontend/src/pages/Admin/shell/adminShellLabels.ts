/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve display label and description for admin shell sections (i18n-aware).
 *
 * Related:
 * - `adminShellConfig.ts`, `AdminShellContentHeader.tsx`
 */

import type { TFunction } from 'i18next';
import {
	ADMIN_SHELL_NAV_GROUPS,
	getAdminShellSectionMeta,
	type AdminNavGroupId,
	type AdminSectionId,
} from './adminShellConfig';

export function resolveAdminNavGroupLabel(
	groupId: AdminNavGroupId,
	t: TFunction<'desktopUi'>
): string {
	const group = ADMIN_SHELL_NAV_GROUPS.find((g) => g.id === groupId);
	if (!group) return groupId;
	if (group.labelI18nKey) return t(group.labelI18nKey);
	return group.label;
}

export function resolveAdminSectionLabel(
	section: AdminSectionId,
	t: TFunction<'desktopUi'>
): string {
	const meta = getAdminShellSectionMeta(section);
	if (meta.labelI18nKey) {
		return t(meta.labelI18nKey);
	}
	return meta.label;
}

export function resolveAdminSectionDescription(
	section: AdminSectionId,
	t: TFunction<'desktopUi'>
): string {
	const meta = getAdminShellSectionMeta(section);
	if (meta.descriptionI18nKey) {
		return t(meta.descriptionI18nKey);
	}
	return meta.description;
}
