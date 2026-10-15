/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P7 locks — launcher role SSOT + openWindow must not defer commit on preload.
 *
 * Related:
 * - utils/desktopLauncherRoles.ts
 * - hooks/useWindowManager.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	DESKTOP_LAUNCHER_ROLES,
	QUICK_SEARCH_IDLE_RECENT_APPS_CAP,
	desktopAppOpenCommitsBeforeChunkReady,
	launcherSurfaceAllowsAppCatalog,
} from '../desktopLauncherRoles';

describe('desktopLauncherRoles (P7/P12)', () => {
	it('keeps three distinct launcher jobs', () => {
		expect(DESKTOP_LAUNCHER_ROLES.start).toBe('personalized_apps_and_pins');
		expect(DESKTOP_LAUNCHER_ROLES.quickSearch).toBe('recents_files_and_find');
		expect(DESKTOP_LAUNCHER_ROLES.commandPalette).toBe(
			'shell_commands_and_actions'
		);
		expect(desktopAppOpenCommitsBeforeChunkReady()).toBe(true);
	});

	it('allows app catalog only on Start', () => {
		expect(launcherSurfaceAllowsAppCatalog('start')).toBe(true);
		expect(launcherSurfaceAllowsAppCatalog('quickSearch')).toBe(false);
		expect(launcherSurfaceAllowsAppCatalog('commandPalette')).toBe(false);
	});

	it('Wave 6: Quick Search idle MRU apps are capped (Start owns catalog)', () => {
		expect(QUICK_SEARCH_IDLE_RECENT_APPS_CAP).toBe(3);
		expect(QUICK_SEARCH_IDLE_RECENT_APPS_CAP).toBeLessThan(5);
	});

	it('openWindow commits immediately and does not gate on preload finally', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const src = readFileSync(
			join(dir, '../../hooks/useWindowManager.ts'),
			'utf8'
		);
		expect(src).toContain('void preloadDesktopApp(item.appComponent)');
		expect(src).toContain('commitOpenWindow(item, options)');
		expect(src).not.toMatch(
			/pendingPreload[\s\S]{0,200}finally\(\(\)\s*=>\s*\{[\s\S]{0,80}commitOpenWindow/
		);
	});
});
