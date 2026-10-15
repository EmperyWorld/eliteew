/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Source lock — Settings tab chrome uses container width + embeddedMobile, not viewport `md:`.
 *
 * Invariants:
 * - Panel must call `resolveDesktopSettingsTabsDesktopLayout` with `embeddedMobileLayout`.
 * - Must not reintroduce Tailwind `md:flex-row` / `md:flex` / `md:hidden` for Settings nav.
 *
 * Related:
 * - DesktopSettingsPanel.tsx
 * - settings/desktopSettingsChromeLayout.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('DesktopSettingsPanel mobile embedded / P6 chrome contract', () => {
	it('gates layout via container-width helper + embeddedMobile, not viewport md:', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(join(dir, '../DesktopSettingsPanel.tsx'), 'utf8');

		expect(src).toContain('resolveDesktopSettingsTabsDesktopLayout');
		expect(src).toContain('embeddedMobileLayout');
		expect(src).toContain('useResizeObserverRect');
		expect(src).toContain("settingsTabsDesktopLayout && 'flex-row'");
		expect(src).toContain('data-desktop-settings-nav');
		expect(src).toContain('data-desktop-settings-root');
		expect(src).not.toContain("settingsTabsDesktopLayout && 'md:flex-row'");
		expect(src).not.toContain("settingsTabsDesktopLayout && 'md:flex'");
		expect(src).not.toContain("settingsTabsDesktopLayout && 'md:hidden'");
	});
});
