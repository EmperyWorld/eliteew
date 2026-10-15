import type { Layout } from 'react-grid-layout';

/**
 * C.28: integer cell coordinates for persisted grid (avoid fractional x/y/w/h from RGL drag).
 */
export function snapLayoutItemToIntegerGrid(
	item: Layout[number],
	cols: number
): Layout[number] {
	const minW = Math.max(1, item.minW ?? 1);
	const minH = Math.max(1, item.minH ?? 1);
	let x = Math.round(Number(item.x) || 0);
	let y = Math.round(Number(item.y) || 0);
	let w = Math.round(Number(item.w) || minW);
	let h = Math.round(Number(item.h) || minH);
	if (!Number.isFinite(x)) x = 0;
	if (!Number.isFinite(y)) y = 0;
	w = Math.max(minW, w);
	h = Math.max(minH, h);
	x = Math.max(0, Math.min(x, Math.max(0, cols - minW)));
	const maxWByCols = cols - x;
	w = Math.min(w, maxWByCols);
	w = Math.max(minW, w);
	if (item.maxW != null) w = Math.min(w, item.maxW);
	if (item.maxH != null) h = Math.min(h, item.maxH);
	w = Math.max(minW, w);
	h = Math.max(minH, h);
	return { ...item, x, y, w, h };
}

export function snapLayoutToIntegerGrid(layout: Layout, cols: number): Layout {
	return layout.map((it) => snapLayoutItemToIntegerGrid(it, cols));
}

/** C.29: keyboard-friendly nudge of tile size on the grid (±1 cell), respecting min/max and column bounds. */
export function nudgeLayoutItemSize(
	layout: Layout,
	itemId: string,
	dw: number,
	dh: number,
	cols: number
): Layout | null {
	const idx = layout.findIndex((x) => x.i === itemId);
	if (idx < 0) return null;
	const raw = layout[idx];
	if (!raw || raw.static) return null;
	const base = snapLayoutItemToIntegerGrid(raw, cols);
	let w = base.w + dw;
	let h = base.h + dh;
	w = Math.round(w);
	h = Math.round(h);
	const minW = Math.max(1, base.minW ?? 1);
	const minH = Math.max(1, base.minH ?? 1);
	w = Math.max(minW, w);
	h = Math.max(minH, h);
	if (base.maxW != null) w = Math.min(w, base.maxW);
	if (base.maxH != null) h = Math.min(h, base.maxH);
	const maxWByCols = cols - base.x;
	w = Math.min(w, maxWByCols);
	w = Math.max(minW, w);
	h = Math.max(minH, h);
	const merged: Layout[number] = { ...base, w, h };
	return layout.map((it, i) =>
		i === idx ? snapLayoutItemToIntegerGrid(merged, cols) : it
	);
}
