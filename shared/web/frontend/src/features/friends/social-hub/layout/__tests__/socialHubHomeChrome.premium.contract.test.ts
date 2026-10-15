/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Social Hub home chrome: sentence-case eyebrows/KPI labels, quiet workspace panel.
 *
 * Invariants:
 * - No DesktopAppSectionLabel / uppercase on home quick-actions or KPI section.
 * - Workspace panel has no accent radial wash.
 *
 * Related:
 * - ../socialHubLayoutTokens.ts
 * - ../SocialHubQuickActions.tsx
 * - ../../sections/SocialHubHomeSection.tsx
 * - documentation/product/SOCIAL-HUB.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
	SH_KPI_LABEL_CLASS,
	SH_SECTION_EYEBROW_CLASS,
	SH_WORKSPACE_PANEL_CLASS,
} from '../socialHubLayoutTokens';

const here = dirname(fileURLToPath(import.meta.url));

describe('socialHubHomeChrome.premium.contract', () => {
	it('keeps section eyebrow and KPI labels sentence-case', () => {
		expect(SH_SECTION_EYEBROW_CLASS).not.toMatch(/\buppercase\b/);
		expect(SH_SECTION_EYEBROW_CLASS).toMatch(/tracking-normal/);
		expect(SH_KPI_LABEL_CLASS).not.toMatch(/\buppercase\b/);
		expect(SH_KPI_LABEL_CLASS).toMatch(/tracking-normal/);
	});

	it('keeps workspace panel without accent radial wash', () => {
		expect(SH_WORKSPACE_PANEL_CLASS).not.toMatch(/radial-gradient/);
		expect(SH_WORKSPACE_PANEL_CLASS).not.toMatch(/desktop-accent-rgb/);
	});

	it('wires home quick-actions and KPI section without DesktopAppSectionLabel', () => {
		const quick = readFileSync(
			join(here, '../SocialHubQuickActions.tsx'),
			'utf8'
		);
		const home = readFileSync(
			join(here, '../../sections/SocialHubHomeSection.tsx'),
			'utf8'
		);
		expect(quick).not.toMatch(/import[\s\S]*DesktopAppSectionLabel/);
		expect(quick).not.toMatch(/<DesktopAppSectionLabel\b/);
		expect(quick).toContain('SH_SECTION_EYEBROW_CLASS');
		expect(home).not.toMatch(/import[\s\S]*DesktopAppSectionLabel/);
		expect(home).not.toMatch(/<DesktopAppSectionLabel\b/);
		expect(home).toContain('SH_SECTION_EYEBROW_CLASS');
	});
});
