/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';
import {
	ADMIN_SECTION_IDS,
	ADMIN_SHELL_NAV_GROUPS,
	ADMIN_SHELL_SECTIONS,
	getAdminShellSectionMeta,
	isAdminSectionId,
	listAdminShellSectionsByGroup,
} from '../shell/adminShellConfig';
import {
	adminShellCanonicalSectionIds,
	adminShellSmokeChecklistSectionIds,
	buildAdminShellSmokeChecklist,
} from '../shell/adminShellSmokeChecklist';

describe('adminShellConfig', () => {
	it('covers every nav group with at least one section', () => {
		for (const group of ADMIN_SHELL_NAV_GROUPS) {
			expect(listAdminShellSectionsByGroup(group.id).length).toBeGreaterThan(0);
		}
	});

	it('has unique section ids', () => {
		const ids = ADMIN_SHELL_SECTIONS.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('validates section id helper', () => {
		expect(isAdminSectionId('users')).toBe(true);
		expect(isAdminSectionId('workers')).toBe(true);
		expect(isAdminSectionId('siteStudio')).toBe(true);
		expect(isAdminSectionId('nope')).toBe(false);
	});

	it('returns meta for workers with aria title id', () => {
		expect(getAdminShellSectionMeta('workers').headerTitleId).toBe(
			'admin-workers-section-title'
		);
	});

	it('returns meta for gaf with aria title id', () => {
		expect(getAdminShellSectionMeta('gaf').headerTitleId).toBe(
			'admin-gaf-section-title'
		);
	});

	it('places Site Studio in product group as breadcrumb shell header', () => {
		const meta = getAdminShellSectionMeta('siteStudio');
		expect(meta.group).toBe('product');
		expect(meta.headerMode).toBe('breadcrumb');
		expect(meta.labelI18nKey).toBe('adminShell.sections.siteStudio');
	});

	it('places UGS v2 in ugsAi group as primary admin section', () => {
		const meta = getAdminShellSectionMeta('ugsV2');
		expect(meta.group).toBe('ugsAi');
		expect(meta.headerMode).toBe('breadcrumb');
		expect(meta.labelI18nKey).toBe('adminShell.sections.ugsV2');
		expect(meta.badge).toBeUndefined();
	});

	it('does not expose retired legacy ugs section in shell nav or section ids', () => {
		const ids = ADMIN_SHELL_SECTIONS.map((s) => s.id);
		expect(ids).not.toContain('ugs');
		expect(isAdminSectionId('ugs')).toBe(false);
		expect(ids).toContain('ugsV2');
	});

	it('keeps ADMIN_SECTION_IDS aligned with ADMIN_SHELL_SECTIONS (matrix contract)', () => {
		const fromSections = new Set(ADMIN_SHELL_SECTIONS.map((s) => s.id));
		expect(ADMIN_SECTION_IDS.size).toBe(fromSections.size);
		for (const id of fromSections) {
			expect(ADMIN_SECTION_IDS.has(id)).toBe(true);
			expect(() => getAdminShellSectionMeta(id)).not.toThrow();
		}
		expect(isAdminSectionId('ugs')).toBe(false);
	});

	it('includes musicForge section in ugsAi group with header title id', () => {
		expect(isAdminSectionId('musicForge')).toBe(true);
		const meta = getAdminShellSectionMeta('musicForge');
		expect(meta.group).toBe('ugsAi');
		expect(meta.headerMode).toBe('full');
		expect(meta.headerTitleId).toBe('admin-music-forge-section-title');
		expect(meta.labelI18nKey).toBe('adminShell.sections.musicForge');
	});

	it('smoke checklist covers every ADMIN_SHELL_SECTIONS id exactly once', () => {
		const checklistIds = adminShellSmokeChecklistSectionIds();
		const canonical = adminShellCanonicalSectionIds();
		expect(new Set(checklistIds).size).toBe(checklistIds.length);
		expect(checklistIds.length).toBe(canonical.size);
		for (const id of canonical) {
			expect(checklistIds).toContain(id);
		}
		expect(checklistIds).not.toContain('ugs');
		const items = buildAdminShellSmokeChecklist();
		expect(
			items.every((row) => row.deepLink === `?section=${row.sectionId}`)
		).toBe(true);
	});
});
