/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Visual line metrics for Ultimate Doc Editor gutter layout — block row measurement
 * via layout rects (not height/lineHeight math).
 *
 * Invariants:
 * - Visual rows merge within GUTTER_VISUAL_LINE_TOP_EPS_PX subpixel tolerance.
 * - TABLE/HR/empty blocks use block bounding rect fallbacks.
 *
 * Related:
 * - TiptapEditor.tsx
 * - tiptapGutterVisualContinuity.ts
 */

export interface VisualLineMetric {
	/** Logical block index (1-based), same for wrap continuation rows of that block. */
	lineNumber: number;
	top: number;
	height: number;
	/** True for 2nd+ visual row when the block soft-wraps (show ↳ instead of re-numbering). */
	isWrapContinuation: boolean;
}

/** Rects on one visual line can differ in `top` by a subpixel; merge within this tolerance. */
const GUTTER_VISUAL_LINE_TOP_EPS_PX = 4;

/** Trailing debounce: gutter layout (getClientRects) — не на каждый keystroke. */
export const GUTTER_LAYOUT_DEBOUNCE_MS = 200;

/**
 * Visual text lines inside a block (soft-wraps), using layout rects — not height/lineHeight math
 * (that breaks for line-height: normal, headings vs body, nested &lt;p&gt; in &lt;li&gt;, etc.).
 */
export function measureVisualRowsInBlock(
	blockEl: HTMLElement,
	rootRect: DOMRect,
	fallbackLineHeight: number
): Array<{ top: number; height: number }> {
	const tag = blockEl.tagName;
	if (tag === 'TABLE') {
		const br = blockEl.getBoundingClientRect();
		const h = Math.max(fallbackLineHeight, br.height || fallbackLineHeight);
		return [{ top: Math.max(0, br.top - rootRect.top), height: h }];
	}
	if (tag === 'HR') {
		const br = blockEl.getBoundingClientRect();
		return [
			{
				top: Math.max(0, br.top - rootRect.top),
				height: Math.max(br.height, 12),
			},
		];
	}

	const blockRect = blockEl.getBoundingClientRect();
	const cs = window.getComputedStyle(blockEl);
	let lineHeightPx = Number.parseFloat(cs.lineHeight);
	if (!Number.isFinite(lineHeightPx) || lineHeightPx <= 0) {
		const fs = Number.parseFloat(cs.fontSize);
		lineHeightPx = Number.isFinite(fs) ? fs * 1.25 : fallbackLineHeight;
	}

	const hasMeaningfulText =
		Boolean(blockEl.textContent?.trim()) ||
		Boolean(blockEl.querySelector('img,br,hr,svg,video,iframe'));

	if (!hasMeaningfulText) {
		return [
			{
				top: Math.max(0, blockRect.top - rootRect.top),
				height: Math.max(blockRect.height, lineHeightPx * 0.85, 12),
			},
		];
	}

	const range = document.createRange();
	try {
		range.selectNodeContents(blockEl);
	} catch {
		return [
			{
				top: Math.max(0, blockRect.top - rootRect.top),
				height: Math.max(blockRect.height, lineHeightPx),
			},
		];
	}

	const rects = Array.from(range.getClientRects()).filter(
		(r) => r.height > 0 && (r.width > 0 || r.right > r.left)
	);
	if (rects.length === 0) {
		return [
			{
				top: Math.max(0, blockRect.top - rootRect.top),
				height: Math.max(blockRect.height, lineHeightPx),
			},
		];
	}

	rects.sort((a, b) => a.top - b.top || a.left - b.left);

	const clusters: { top: number; bottom: number }[] = [];
	for (const r of rects) {
		const last = clusters[clusters.length - 1];
		if (last && Math.abs(r.top - last.top) < GUTTER_VISUAL_LINE_TOP_EPS_PX) {
			last.top = Math.min(last.top, r.top);
			last.bottom = Math.max(last.bottom, r.bottom);
		} else {
			clusters.push({ top: r.top, bottom: r.bottom });
		}
	}

	return clusters.map((c) => ({
		top: Math.max(0, c.top - rootRect.top),
		height: Math.max(c.bottom - c.top, lineHeightPx * 0.85, 10),
	}));
}
