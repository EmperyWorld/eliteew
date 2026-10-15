/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression tests for stacked default desktop icon cluster detection and grid fan-out on hydrate.
 *
 * Invariants:
 * - Clusters require two or more root icons on the same default anchor.
 *
 * Related:
 * - `desktopIconPositionSanitizer.ts`
 */
import { DESKTOP_GRID, DESKTOP_GRID_STEPS } from '@/pages/Desktop/constants';
import type { DesktopItem } from '@/pages/Desktop/types/desktop.types';
import {
	isDesktopDefaultIconClusterAnchor,
	sanitizeStackedDesktopIconPositions,
} from '@/pages/Desktop/utils/desktopIconPositionSanitizer';
import { describe, expect, it } from 'vitest';

function rootApp(id: string, name: string, x: number, y: number): DesktopItem {
	return {
		id,
		name,
		type: 'app',
		position: { x, y },
	};
}

describe('isDesktopDefaultIconClusterAnchor', () => {
	it('recognizes grid offset and origin defaults', () => {
		expect(
			isDesktopDefaultIconClusterAnchor(
				DESKTOP_GRID.OFFSET,
				DESKTOP_GRID.OFFSET
			)
		).toBe(true);
		expect(isDesktopDefaultIconClusterAnchor(0, 0)).toBe(true);
		expect(isDesktopDefaultIconClusterAnchor(115, 20)).toBe(false);
	});
});

describe('sanitizeStackedDesktopIconPositions', () => {
	it('returns the same reference when only one icon sits on a default anchor', () => {
		const items = [
			rootApp('a', 'Alpha', DESKTOP_GRID.OFFSET, DESKTOP_GRID.OFFSET),
		];
		const result = sanitizeStackedDesktopIconPositions({
			items,
			gridStepKey: 'medium',
		});
		expect(result.changed).toBe(false);
		expect(result.items).toBe(items);
		expect(result.changedItemIds).toEqual([]);
	});

	it('fans out multiple root icons stacked at (20,20) onto distinct grid cells', () => {
		const stacked = [
			rootApp('a', 'Alpha', 20, 20),
			rootApp('b', 'Beta', 20, 20),
			rootApp('c', 'Gamma', 20, 20),
		];
		const result = sanitizeStackedDesktopIconPositions({
			items: stacked,
			gridStepKey: 'medium',
		});
		expect(result.changed).toBe(true);
		expect(result.changedItemIds.sort()).toEqual(['b', 'c']);

		const positions = result.items.map((item) => item.position);
		const uniqueKeys = new Set(
			positions.map((position) => `${position.x},${position.y}`)
		);
		expect(uniqueKeys.size).toBe(3);
		expect(result.items.find((item) => item.id === 'a')?.position).toEqual({
			x: 20,
			y: 20,
		});

		for (const position of positions) {
			expect(position.x).toBeGreaterThanOrEqual(DESKTOP_GRID.OFFSET);
			expect(position.y).toBeGreaterThanOrEqual(DESKTOP_GRID.OFFSET);
			const snappedX =
				Math.round(
					(position.x - DESKTOP_GRID.OFFSET) / DESKTOP_GRID_STEPS.medium
				) *
					DESKTOP_GRID_STEPS.medium +
				DESKTOP_GRID.OFFSET;
			const snappedY =
				Math.round(
					(position.y - DESKTOP_GRID.OFFSET) / DESKTOP_GRID_STEPS.medium
				) *
					DESKTOP_GRID_STEPS.medium +
				DESKTOP_GRID.OFFSET;
			expect(position.x).toBe(snappedX);
			expect(position.y).toBe(snappedY);
		}
	});

	it('fans out multiple icons stacked at (0,0)', () => {
		const stacked = [rootApp('a', 'Alpha', 0, 0), rootApp('b', 'Beta', 0, 0)];
		const result = sanitizeStackedDesktopIconPositions({
			items: stacked,
			gridStepKey: 'small',
		});
		expect(result.changed).toBe(true);
		const keys = new Set(
			result.items.map((item) => `${item.position.x},${item.position.y}`)
		);
		expect(keys.size).toBe(2);
	});

	it('ignores folder children and hidden apps when counting clusters', () => {
		const items: DesktopItem[] = [
			rootApp('visible', 'Visible', 20, 20),
			{
				id: 'nested',
				name: 'Nested',
				type: 'file',
				parentId: 'folder-1',
				position: { x: 20, y: 20 },
			},
			{
				id: 'hidden',
				name: 'Hidden',
				type: 'app',
				position: { x: 20, y: 20 },
			},
		];
		const installed = new Set(['visible']);
		const result = sanitizeStackedDesktopIconPositions({
			items,
			gridStepKey: 'medium',
			installedAppIds: installed,
		});
		expect(result.changed).toBe(false);
		expect(result.items).toBe(items);
	});

	it('does not move icons that already have distinct positions', () => {
		const items = [
			rootApp('a', 'Alpha', 20, 20),
			rootApp('b', 'Beta', 500, 680),
		];
		const result = sanitizeStackedDesktopIconPositions({
			items,
			gridStepKey: 'medium',
		});
		expect(result.changed).toBe(false);
		expect(result.items).toBe(items);
	});
});
