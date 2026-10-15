/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Viewport-scoped gutter layout helpers — limit expensive getClientRects work on initial mount.
 *
 * Invariants:
 * - Viewport scope skips blocks outside the visible band; full scope measures every block.
 *
 * Related:
 * - TiptapEditor.tsx
 * - tiptapGutterLayoutScheduling.ts
 */

export const GUTTER_VIEWPORT_OVERSCAN_PX = 320;

export type GutterLayoutScope = 'full' | 'viewport';

export function intersectsExpandedViewport(
	target: DOMRect,
	viewport: DOMRect,
	overscanPx: number
): boolean {
	return (
		target.bottom >= viewport.top - overscanPx &&
		target.top <= viewport.bottom + overscanPx
	);
}

export function blockRectIntersectsViewport(
	blockRect: DOMRect,
	viewportRect: DOMRect,
	overscanPx: number = GUTTER_VIEWPORT_OVERSCAN_PX
): boolean {
	return intersectsExpandedViewport(blockRect, viewportRect, overscanPx);
}

export function resolveProseMirrorViewportRect(
	proseMirrorRoot: HTMLElement
): DOMRect {
	let node: HTMLElement | null = proseMirrorRoot;
	while (node) {
		const style = window.getComputedStyle(node);
		const overflowY = style.overflowY;
		if (
			(overflowY === 'auto' ||
				overflowY === 'scroll' ||
				overflowY === 'overlay') &&
			node.scrollHeight > node.clientHeight
		) {
			return node.getBoundingClientRect();
		}
		node = node.parentElement;
	}
	return proseMirrorRoot.getBoundingClientRect();
}

export function isBlockInGutterViewport(
	blockEl: HTMLElement,
	viewportRect: DOMRect,
	overscanPx: number = GUTTER_VIEWPORT_OVERSCAN_PX
): boolean {
	return blockRectIntersectsViewport(
		blockEl.getBoundingClientRect(),
		viewportRect,
		overscanPx
	);
}
