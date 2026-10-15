/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit lock for Content Manager virtualization thresholds.
 *
 * Invariants:
 * - Grid virtualization stays off for mobile / inline preview / small lists.
 *
 * Related:
 * - contentManagerVirtualization.ts
 */
import { describe, expect, it } from 'vitest';
import {
	CM_FILE_CARD_META_CHROME_PX,
	CM_FILE_CARD_THUMB_MAX_H_PX,
	CM_GRID_VIRTUALIZE_MIN_ITEMS,
	CM_LIST_VIRTUALIZE_MIN_ITEMS,
	CM_VIRTUAL_GRID_CELL_PAD_PX,
	CM_VIRTUAL_GRID_ROW_HEIGHT_PX,
	computeVirtualGridColumnWidthPx,
	estimateContentManagerVirtualGridRowHeightPx,
	shouldVirtualizeContentManagerGrid,
	shouldVirtualizeContentManagerList,
} from './contentManagerVirtualization';

describe('contentManagerVirtualization', () => {
	it('enables dense grid only for desktop without inline preview', () => {
		expect(
			shouldVirtualizeContentManagerGrid({
				itemCount: CM_GRID_VIRTUALIZE_MIN_ITEMS,
				isMobile: false,
				hasInlinePreview: false,
			})
		).toBe(true);
		expect(
			shouldVirtualizeContentManagerGrid({
				itemCount: CM_GRID_VIRTUALIZE_MIN_ITEMS,
				isMobile: true,
				hasInlinePreview: false,
			})
		).toBe(false);
		expect(
			shouldVirtualizeContentManagerGrid({
				itemCount: CM_GRID_VIRTUALIZE_MIN_ITEMS,
				isMobile: false,
				hasInlinePreview: true,
			})
		).toBe(false);
		expect(
			shouldVirtualizeContentManagerGrid({
				itemCount: CM_GRID_VIRTUALIZE_MIN_ITEMS - 1,
				isMobile: false,
				hasInlinePreview: false,
			})
		).toBe(false);
	});

	it('enables list virtualization above threshold', () => {
		expect(
			shouldVirtualizeContentManagerList(CM_LIST_VIRTUALIZE_MIN_ITEMS)
		).toBe(false);
		expect(
			shouldVirtualizeContentManagerList(CM_LIST_VIRTUALIZE_MIN_ITEMS + 1)
		).toBe(true);
	});

	it('computes column width from panel geometry', () => {
		expect(computeVirtualGridColumnWidthPx(400, 2)).toBeGreaterThanOrEqual(176);
	});

	it('estimates grid row height from card chrome, not a short fixed slot', () => {
		const wide = estimateContentManagerVirtualGridRowHeightPx(280);
		expect(wide).toBe(
			CM_VIRTUAL_GRID_CELL_PAD_PX +
				CM_FILE_CARD_THUMB_MAX_H_PX +
				CM_FILE_CARD_META_CHROME_PX
		);
		expect(wide).toBeGreaterThan(300);
		expect(CM_VIRTUAL_GRID_ROW_HEIGHT_PX).toBeGreaterThan(300);
		expect(estimateContentManagerVirtualGridRowHeightPx(120)).toBeLessThan(
			wide
		);
	});
});
