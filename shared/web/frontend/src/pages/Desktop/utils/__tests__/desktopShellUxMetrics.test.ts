/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest lock for FE-only desktop shell UX observability events and Wave 4
 * keyboard Tab budgets.
 *
 * Invariants:
 * - Conflict and offline banner event names stay stable.
 * - Identical transitions are debounced once per name+kind.
 * - Start All-apps and Settings Tab budgets stay within frozen Wave 4 ceilings.
 *
 * Related:
 * - ../desktopShellUxMetrics.ts
 * - ../../components/startMenu/StartMenuTabStrip.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	SETTINGS_TABS_MAX_TABS_TO_PRIMARY,
	START_ALL_APPS_MAX_TABS_TO_PRIMARY,
	START_MENU_ALL_APPS_PRIMARY_TAB_INDEX,
	recordDesktopShellUxEvent,
	resetDesktopShellUxMetricsForTests,
} from '../desktopShellUxMetrics';

describe('desktopShellUxMetrics', () => {
	afterEach(() => {
		resetDesktopShellUxMetricsForTests();
		vi.restoreAllMocks();
	});

	it('emits stable conflict and offline event names', () => {
		const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		recordDesktopShellUxEvent('desktop_shell_offline_banner_shown');
		recordDesktopShellUxEvent('desktop_shell_sync_conflict_shown', {
			kind: 'stale_shell_conflict',
		});
		recordDesktopShellUxEvent('desktop_shell_offline_banner_retry');
		expect(spy).toHaveBeenCalledTimes(3);
		expect(spy.mock.calls[0]?.[1]).toMatchObject({
			event: 'desktop_shell_offline_banner_shown',
		});
		expect(spy.mock.calls[1]?.[1]).toMatchObject({
			event: 'desktop_shell_sync_conflict_shown',
			kind: 'stale_shell_conflict',
		});
		expect(spy.mock.calls[2]?.[1]).toMatchObject({
			event: 'desktop_shell_offline_banner_retry',
		});
	});

	it('debounces identical conflict transitions', () => {
		const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		recordDesktopShellUxEvent('desktop_shell_sync_conflict_shown', {
			kind: 'tab_conflict',
		});
		recordDesktopShellUxEvent('desktop_shell_sync_conflict_shown', {
			kind: 'tab_conflict',
		});
		expect(spy).toHaveBeenCalledTimes(1);
		recordDesktopShellUxEvent('desktop_shell_sync_conflict_shown', {
			kind: 'stale_shell_conflict',
		});
		expect(spy).toHaveBeenCalledTimes(2);
	});

	it('freezes Wave 4 Start / Settings keyboard Tab budgets', () => {
		expect(START_ALL_APPS_MAX_TABS_TO_PRIMARY).toBe(6);
		expect(SETTINGS_TABS_MAX_TABS_TO_PRIMARY).toBe(3);
		expect(START_MENU_ALL_APPS_PRIMARY_TAB_INDEX).toBe(1);
		expect(START_ALL_APPS_MAX_TABS_TO_PRIMARY).toBeGreaterThanOrEqual(
			START_MENU_ALL_APPS_PRIMARY_TAB_INDEX + 1
		);
	});

	it('keeps All apps on the Start primary strip (not More menu)', () => {
		const dir = dirname(fileURLToPath(import.meta.url));
		const strip = readFileSync(
			join(dir, '../../components/startMenu/StartMenuTabStrip.tsx'),
			'utf8'
		);
		expect(strip).toContain("id: 'all'");
		expect(strip).toContain('PRIMARY_TABS');
		const primaryBlock = strip.slice(
			strip.indexOf('const PRIMARY_TABS'),
			strip.indexOf('const SECONDARY_TABS')
		);
		expect(primaryBlock).toContain("id: 'all'");
		const secondaryBlock = strip.slice(strip.indexOf('const SECONDARY_TABS'));
		expect(secondaryBlock).not.toMatch(/id:\s*'all'/);
		expect(strip).toContain('start-menu-tab-');
	});
});
