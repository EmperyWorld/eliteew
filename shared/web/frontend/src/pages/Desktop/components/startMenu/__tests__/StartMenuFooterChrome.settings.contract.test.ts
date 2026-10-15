/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source contract: Start Menu footer Settings must dismiss the menu like Profile/Admin/App Store.
 *
 * Related:
 * - ../StartMenuFooterChrome.tsx
 * - documentation/product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ELITEEW_SOURCE_CODE_URL } from '@/legal/sourceCode';

describe('StartMenuFooterChrome settings dismiss contract', () => {
	const dir = dirname(fileURLToPath(import.meta.url));
	const footerSource = () =>
		readFileSync(join(dir, '../StartMenuFooterChrome.tsx'), 'utf8');

	it('Settings button calls onWallpaper then onClose', () => {
		const src = footerSource();
		expect(src).toContain('startMenu.settingsAria');
		expect(src).toMatch(
			/onClick=\{\(\)\s*=>\s*\{\s*onWallpaper\(\);\s*onClose\(\);\s*\}\}/
		);
	});

	it('Profile and App Store already dismiss via onClose', () => {
		const src = footerSource();
		expect(src).toContain('onOpenProfile()');
		expect(src).toContain('onAppStore()');
		expect(src.match(/onClose\(\)/g)?.length).toBeGreaterThanOrEqual(4);
	});

	it('exposes the corresponding MIT source in a safe external link', () => {
		const src = footerSource();
		expect(ELITEEW_SOURCE_CODE_URL).toBe(
			'https://github.com/EmperyWorld/eliteew'
		);
		expect(src).toContain('ELITEEW_SOURCE_CODE_URL');
		expect(src).toContain('startMenu.sourceCodeAria');
		expect(src).toContain('target="_blank"');
		expect(src).toContain('rel="noopener noreferrer"');
	});
});
