/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 1 Cause lock — Recent tab stays progressive (not a second catalog wall).
 *
 * Invariants:
 * - Idle Recent MRU uses `home-short` + `START_MENU_RECENT_MRU_CAP` in StartMenuLegacy.
 * - Collapsed discovery shows preview; full library/recommended behind disclosure.
 * - Recommended chips capped by `START_MENU_RECENT_RECOMMENDED_CAP`.
 *
 * Related:
 * - ../StartMenuRecentDiscovery.tsx
 * - ../../StartMenuLegacy.tsx
 * - ../../../types/desktopStartMenu.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	START_MENU_RECENT_LIBRARY_PREVIEW_CAP,
	START_MENU_RECENT_MRU_CAP,
	START_MENU_RECENT_RECOMMENDED_CAP,
} from '../../../types/desktopStartMenu';

describe('StartMenu Recent progressive Cause (Wave 1)', () => {
	const dir = dirname(fileURLToPath(import.meta.url));

	it('exports progressive caps for Recent idle MRU and library preview', () => {
		expect(START_MENU_RECENT_MRU_CAP).toBe(6);
		expect(START_MENU_RECENT_LIBRARY_PREVIEW_CAP).toBe(3);
		expect(START_MENU_RECENT_RECOMMENDED_CAP).toBeLessThanOrEqual(8);
	});

	it('StartMenuLegacy wires Recent idle home-short density and MRU cap', () => {
		const src = readFileSync(join(dir, '../../StartMenuLegacy.tsx'), 'utf8');
		expect(src).toContain('START_MENU_RECENT_MRU_CAP');
		expect(src).toContain("resolvedTab === 'recent'");
		expect(src).toContain('startMenuGridDensity');
		expect(src).toContain('density=');
		expect(src).toContain('recentTabApps');
	});

	it('StartMenuRecentDiscovery keeps full library behind disclosure', () => {
		const src = readFileSync(
			join(dir, '../StartMenuRecentDiscovery.tsx'),
			'utf8'
		);
		expect(src).toContain('start-menu-recent-library-preview');
		expect(src).toContain('START_MENU_RECENT_LIBRARY_PREVIEW_CAP');
		expect(src).toContain('START_MENU_RECENT_RECOMMENDED_CAP');
		expect(src).toContain('showLibraryDiscovery && recommendedAppsFiltered');
		expect(src).not.toMatch(/slice\(0,\s*16\)/);
	});
});
