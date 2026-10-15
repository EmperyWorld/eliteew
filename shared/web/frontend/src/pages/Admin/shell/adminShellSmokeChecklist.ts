/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Operator smoke checklist lines derived from ADMIN_SHELL_SECTIONS (SSOT) — no drift vs nav.
 *
 * Invariants:
 * - Every live section appears exactly once; retired legacy `ugs` is never listed.
 *
 * Related:
 * - pages/Admin/shell/adminShellConfig.ts
 * - documentation/platform/UNIFIED-ADMIN-SHELL.md
 * - docker/scripts/unified-admin-shell-checklist.sh
 */

import {
	ADMIN_SHELL_NAV_GROUPS,
	ADMIN_SHELL_SECTIONS,
	listAdminShellSectionsByGroup,
	type AdminSectionId,
} from './adminShellConfig';

export type AdminShellSmokeChecklistItem = {
	groupId: string;
	sectionId: AdminSectionId;
	label: string;
	labelI18nKey?: string;
	deepLink: string;
};

/** Ordered checklist: nav group order × sections in that group. */
export function buildAdminShellSmokeChecklist(): AdminShellSmokeChecklistItem[] {
	const items: AdminShellSmokeChecklistItem[] = [];
	for (const group of ADMIN_SHELL_NAV_GROUPS) {
		for (const section of listAdminShellSectionsByGroup(group.id)) {
			items.push({
				groupId: group.id,
				sectionId: section.id,
				label: section.label,
				labelI18nKey: section.labelI18nKey,
				deepLink: `?section=${section.id}`,
			});
		}
	}
	return items;
}

/** Stable section ids covered by the checklist (for Vitest parity). */
export function adminShellSmokeChecklistSectionIds(): AdminSectionId[] {
	return buildAdminShellSmokeChecklist().map((item) => item.sectionId);
}

/** Human-readable lines for operator docs / CLI print. */
export function formatAdminShellSmokeChecklistLines(): string[] {
	return buildAdminShellSmokeChecklist().map(
		(item) =>
			`[${item.groupId}] ${item.sectionId} — ${item.deepLink}` +
			(item.labelI18nKey ? ` (${item.labelI18nKey})` : ` (${item.label})`)
	);
}

/** All SSOT section ids (unordered set check helper). */
export function adminShellCanonicalSectionIds(): ReadonlySet<AdminSectionId> {
	return new Set(ADMIN_SHELL_SECTIONS.map((s) => s.id));
}
