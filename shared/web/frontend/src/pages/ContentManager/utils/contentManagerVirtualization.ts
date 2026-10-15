/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thresholds and geometry helpers for Content Manager files VirtualGrid / VirtualList.
 *
 * Invariants:
 * - Virtualization activates only for dense groups; light lists keep CSS grid / content-visibility.
 * - Grid `rowHeight` is an estimate only — `VirtualGrid` measures real card rows.
 *
 * Related:
 * - documentation/product/FRONTEND-VIRTUAL-LIST-AND-PERF-PATTERNS.md
 * - ContentManagerFilesListBody.tsx
 * - components/ContentManagerFileCard.tsx
 */

/** Dense grid: VirtualGrid when card count reaches this (desktop, no inline preview). */
export const CM_GRID_VIRTUALIZE_MIN_ITEMS = 32;

/** Dense list: VirtualList when row count exceeds this within a group. */
export const CM_LIST_VIRTUALIZE_MIN_ITEMS = 50;

/** Cell pad in ContentManagerFilesGridVirtualBlock (`p-1.5` × 2). */
export const CM_VIRTUAL_GRID_CELL_PAD_PX = 12;

/**
 * Thumb cap from ContentManagerFileCard (`sm:max-h-[142px]`, aspect-4/3).
 * Kept in sync with card chrome — not a layout override.
 */
export const CM_FILE_CARD_THUMB_MAX_H_PX = 142;
export const CM_FILE_CARD_THUMB_MIN_H_PX = 96;

/**
 * Title + meta + tags + preview CTA under the thumb (collapsed card, no inline media).
 * Measurement corrects taller rows (inline preview, wrapping tags).
 */
export const CM_FILE_CARD_META_CHROME_PX = 188;

export const CM_VIRTUAL_LIST_ROW_HEIGHT_PX = 56;
export const CM_VIRTUAL_GRID_OVERSCAN_ROWS = 5;

/**
 * Initial VirtualGrid row estimate from column width + FileCard thumb/meta chrome.
 * Real rows are measured; this only reduces first-paint scrollbar jump.
 */
export function estimateContentManagerVirtualGridRowHeightPx(
	columnWidthPx: number
): number {
	const usableThumbWidth = Math.max(
		1,
		columnWidthPx - CM_VIRTUAL_GRID_CELL_PAD_PX
	);
	const aspectThumbH = Math.round((usableThumbWidth * 3) / 4);
	const thumbH = Math.min(
		CM_FILE_CARD_THUMB_MAX_H_PX,
		Math.max(CM_FILE_CARD_THUMB_MIN_H_PX, aspectThumbH)
	);
	return CM_VIRTUAL_GRID_CELL_PAD_PX + thumbH + CM_FILE_CARD_META_CHROME_PX;
}

/**
 * Fallback estimate when column width is unknown (CSS `contain-intrinsic-size`, tests).
 * Prefer {@link estimateContentManagerVirtualGridRowHeightPx}.
 */
export const CM_VIRTUAL_GRID_ROW_HEIGHT_PX =
	estimateContentManagerVirtualGridRowHeightPx(220);

export function shouldVirtualizeContentManagerGrid(args: {
	itemCount: number;
	isMobile: boolean;
	hasInlinePreview: boolean;
}): boolean {
	return (
		!args.isMobile &&
		!args.hasInlinePreview &&
		args.itemCount >= CM_GRID_VIRTUALIZE_MIN_ITEMS
	);
}

export function shouldVirtualizeContentManagerList(itemCount: number): boolean {
	return itemCount > CM_LIST_VIRTUALIZE_MIN_ITEMS;
}

export function computeVirtualGridColumnWidthPx(
	panelWidthPx: number,
	columnCount: number
): number {
	const cols = Math.max(1, columnCount);
	const gapPx = 12;
	const usable = Math.max(176, panelWidthPx - gapPx * (cols - 1));
	return Math.max(176, Math.floor(usable / cols));
}
