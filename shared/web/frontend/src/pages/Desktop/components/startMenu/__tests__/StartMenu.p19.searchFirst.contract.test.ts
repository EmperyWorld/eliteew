/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * P19 search-first Start IA locks: Home default, no category wall on Home,
 * categories deep-link → all, Home surface does not mount RecentDiscovery.
 *
 * Invariants:
 * - Source contracts only (no full StartMenu mount).
 *
 * Related:
 * - ../StartMenuHomeSurface.tsx
 * - ../../types/desktopStartMenu.ts
 * - ../StartMenuLegacy.tsx
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	resolveStartMenuTab,
	START_MENU_HOME_SHORT_LIST_CAP,
} from '../../../types/desktopStartMenu';

describe('StartMenu P19 search-first', () => {
	const dir = dirname(fileURLToPath(import.meta.url));

	it('resolves categories alias to all', () => {
		expect(resolveStartMenuTab('categories')).toBe('all');
		expect(resolveStartMenuTab('home')).toBe('home');
		expect(resolveStartMenuTab('all')).toBe('all');
		expect(START_MENU_HOME_SHORT_LIST_CAP).toBe(6);
	});

	it('Home surface never mounts category wall or RecentDiscovery', () => {
		const home = readFileSync(join(dir, '../StartMenuHomeSurface.tsx'), 'utf8');
		expect(home).toContain('data-testid="start-menu-home"');
		expect(home).toContain('start-menu-home-all-apps');
		expect(home).not.toMatch(/from ['"].*StartMenuRecentDiscovery/);
		expect(home).not.toContain('START_MENU_CATEGORIES_STACK_CLASS');
		expect(home).not.toContain('sortedCategories');
		expect(home).not.toContain('<StartMenuRecentDiscovery');
		expect(home).toContain('density="home-short"');
		expect(home).toContain('density="catalog"');
	});

	it('Legacy defaults to home and mounts Home / All branches', () => {
		const legacy = readFileSync(join(dir, '../../StartMenuLegacy.tsx'), 'utf8');
		expect(legacy).toContain("useState<StartMenuTab>('home')");
		expect(legacy).toContain('StartMenuHomeSurface');
		expect(legacy).toContain("resolvedTab === 'home'");
		expect(legacy).toContain("resolvedTab === 'all'");
		expect(legacy).toContain('start-menu-all-apps');
		expect(legacy).not.toContain("activeTab === 'categories'");
		expect(legacy).toContain('startMenuGridDensity');
		expect(legacy).toContain('resolveStartMenuAppGridColsForDensity');
	});
});
