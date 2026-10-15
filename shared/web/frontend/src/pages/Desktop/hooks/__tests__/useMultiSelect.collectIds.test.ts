/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock null-safe desktop icon id collection (Ctrl+A crash regression).
 *
 * Related:
 * - src/pages/Desktop/hooks/useMultiSelect.ts
 */

import { describe, expect, it } from 'vitest';

import { collectDesktopIconIdsFromContainer } from '@/pages/Desktop/hooks/useMultiSelect';

describe('collectDesktopIconIdsFromContainer', () => {
	it('returns empty array when container is null/undefined', () => {
		expect(collectDesktopIconIdsFromContainer(null)).toEqual([]);
		expect(collectDesktopIconIdsFromContainer(undefined)).toEqual([]);
	});

	it('reads data-desktop-icon-id from icons', () => {
		const root = document.createElement('div');
		const a = document.createElement('div');
		a.setAttribute('data-desktop-icon', '');
		a.setAttribute('data-desktop-icon-id', 'icon-a');
		const b = document.createElement('div');
		b.setAttribute('data-desktop-icon', '');
		b.setAttribute('data-item-id', 'legacy-b');
		root.append(a, b);
		expect(collectDesktopIconIdsFromContainer(root)).toEqual([
			'icon-a',
			'legacy-b',
		]);
	});
});
