/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Social Hub sidebar chrome: sentence-case section eyebrow, no DesktopAppSectionLabel shout.
 *
 * Related:
 * - SocialHubSidebarNav.tsx, socialHubLayoutTokens.ts
 * - documentation/product/SOCIAL-HUB.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SH_SIDEBAR_SECTION_LABEL_CLASS } from '../socialHubLayoutTokens';

const dir = dirname(fileURLToPath(import.meta.url));

function readSrc(relativeFromTests: string): string {
	return readFileSync(join(dir, relativeFromTests), 'utf8');
}

function stripComments(src: string): string {
	return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('Social Hub sidebar premium chrome', () => {
	it('keeps section label sentence-case', () => {
		expect(SH_SIDEBAR_SECTION_LABEL_CLASS).not.toMatch(/\buppercase\b/);
		expect(SH_SIDEBAR_SECTION_LABEL_CLASS).toMatch(/tracking-normal/);
	});

	it('wires quiet label token without DesktopAppSectionLabel', () => {
		const nav = stripComments(readSrc('../SocialHubSidebarNav.tsx'));
		expect(nav).toContain('SH_SIDEBAR_SECTION_LABEL_CLASS');
		expect(nav).not.toContain('DesktopAppSectionLabel');
		expect(nav).not.toMatch(/\buppercase\b/);
	});
});
