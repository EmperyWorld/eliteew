/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Viewport gutter scope intersection contracts.
 *
 * Related:
 * - tiptapGutterViewportScope.ts
 */

import { describe, expect, it } from 'vitest';
import {
	blockRectIntersectsViewport,
	GUTTER_VIEWPORT_OVERSCAN_PX,
	intersectsExpandedViewport,
} from './tiptapGutterViewportScope';

describe('tiptapGutterViewportScope', () => {
	it('detects block intersecting expanded viewport band', () => {
		const viewport = new DOMRect(0, 100, 800, 600);
		const block = new DOMRect(0, 200, 800, 24);
		expect(
			blockRectIntersectsViewport(block, viewport, GUTTER_VIEWPORT_OVERSCAN_PX)
		).toBe(true);
	});

	it('excludes blocks far below the viewport on initial lazy pass', () => {
		const viewport = new DOMRect(0, 100, 800, 600);
		const block = new DOMRect(0, 5000, 800, 24);
		expect(
			blockRectIntersectsViewport(block, viewport, GUTTER_VIEWPORT_OVERSCAN_PX)
		).toBe(false);
	});

	it('includes blocks within overscan padding above viewport', () => {
		const viewport = new DOMRect(0, 400, 800, 600);
		const block = new DOMRect(0, 200, 800, 24);
		expect(intersectsExpandedViewport(block, viewport, 320)).toBe(true);
	});
});
