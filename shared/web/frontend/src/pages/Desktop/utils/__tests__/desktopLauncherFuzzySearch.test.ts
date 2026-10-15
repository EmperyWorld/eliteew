/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for shared desktop launcher fuzzy ranking (Single Brain).
 *
 * Related:
 * - `utils/desktopLauncherFuzzySearch.ts`
 */

import { describe, expect, it } from 'vitest';
import { rankDesktopAppsForQuery } from '../../utils/desktopLauncherFuzzySearch';
import type { DesktopItem } from '../../types/desktop.types';

function app(
	partial: Partial<DesktopItem> & Pick<DesktopItem, 'id' | 'name'>
): DesktopItem {
	return {
		type: 'app',
		appComponent: 'TestApp',
		x: 0,
		y: 0,
		...partial,
	} as DesktopItem;
}

describe('rankDesktopAppsForQuery', () => {
	it('returns empty for empty query', () => {
		expect(
			rankDesktopAppsForQuery('', [app({ id: '1', name: 'Mail' })], [])
		).toEqual([]);
	});

	it('ranks exact match above prefix and fuzzy', () => {
		const items = [
			app({ id: 'a', name: 'Notes' }),
			app({ id: 'b', name: 'Note' }),
			app({ id: 'c', name: 'Notion Pro' }),
		];
		const hits = rankDesktopAppsForQuery('note', items, []);
		expect(hits[0]?.item.id).toBe('b');
		expect(hits[0]?.matches).toContain('exact');
	});

	it('boosts recently used apps', () => {
		const items = [
			app({ id: 'cold', name: 'Calendar' }),
			app({ id: 'hot', name: 'Calculator' }),
		];
		const recent = [app({ id: 'hot', name: 'Calculator' })];
		const hits = rankDesktopAppsForQuery('cal', items, recent);
		expect(hits[0]?.item.id).toBe('hot');
	});
});
