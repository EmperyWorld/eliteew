/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract: session restore must not batch-preload heavy app chunks (EWA, etc.).
 *
 * Related:
 * - utils/preloadDesktopApp.ts
 * - hooks/useWindowManager.ts
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	DESKTOP_PRELOAD_DEFER_ON_RESTORE,
	filterDesktopAppsForRestorePreload,
} from '../preloadDesktopApp';

const dir = dirname(fileURLToPath(import.meta.url));

describe('preloadDesktopApp restore defer', () => {
	it('defers EwaApp and other heavy apps on restore batch', () => {
		expect(DESKTOP_PRELOAD_DEFER_ON_RESTORE.has('EwaApp')).toBe(true);
		expect(DESKTOP_PRELOAD_DEFER_ON_RESTORE.has('ContentManagerPro')).toBe(
			true
		);
		expect(DESKTOP_PRELOAD_DEFER_ON_RESTORE.has('GAFChatApp')).toBe(false);
	});

	it('filterDesktopAppsForRestorePreload drops deferred ids', () => {
		expect(
			filterDesktopAppsForRestorePreload(['GAFChatApp', 'EwaApp', 'UGS'])
		).toEqual(['GAFChatApp', 'UGS']);
	});

	it('useWindowManager restores without awaiting preloadDesktopApps', () => {
		const src = readFileSync(
			join(dir, '../../hooks/useWindowManager.ts'),
			'utf8'
		);
		expect(src).toContain('deferHeavy: true');
		expect(src).not.toMatch(
			/void preloadDesktopApps\([\s\S]*?\)\.finally\(\(\) => \{/
		);
		expect(src).toMatch(/setWindows\(restored\.windows\);/);
	});
});
