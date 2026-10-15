/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock spotlight target picking: skip full-viewport and invisible nodes.
 *
 * Invariants:
 * - A painted compact node wins over an inset-0 overlay of the same selector.
 *
 * Related:
 * - guideTourHighlightTarget.ts
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
	findVisibleGuideHighlight,
	isUsefulGuideSpotlightRect,
} from '../guideTourHighlightTarget';

afterEach(() => {
	document.body.replaceChildren();
});

describe('findVisibleGuideHighlight', () => {
	it('skips opacity-0 and full-viewport nodes, then picks a compact match', () => {
		const root = document.createElement('div');
		root.id = 'desktop-main';
		root.innerHTML = `
			<div data-guide="panel" style="position:absolute;inset:0;width:100vw;height:100vh"></div>
			<div data-guide="panel" hidden style="width:120px;height:80px"></div>
			<aside data-guide="panel" style="width:220px;height:160px">widgets</aside>
		`;
		document.body.append(root);
		Object.defineProperty(window, 'innerWidth', {
			value: 1280,
			configurable: true,
		});
		Object.defineProperty(window, 'innerHeight', {
			value: 800,
			configurable: true,
		});

		const huge = root.querySelector('div[data-guide="panel"]');
		if (huge instanceof HTMLElement) {
			huge.getBoundingClientRect = () =>
				({
					width: 1280,
					height: 800,
					top: 0,
					left: 0,
					bottom: 800,
					right: 1280,
					x: 0,
					y: 0,
					toJSON() {},
				}) as DOMRect;
		}
		const hidden = root.querySelectorAll('div[data-guide="panel"]')[1];
		if (hidden instanceof HTMLElement) {
			hidden.getBoundingClientRect = () =>
				({
					width: 120,
					height: 80,
					top: 10,
					left: 10,
					bottom: 90,
					right: 130,
					x: 10,
					y: 10,
					toJSON() {},
				}) as DOMRect;
		}
		const compact = root.querySelector('aside');
		if (compact instanceof HTMLElement) {
			compact.getBoundingClientRect = () =>
				({
					width: 220,
					height: 160,
					top: 40,
					left: 40,
					bottom: 200,
					right: 260,
					x: 40,
					y: 40,
					toJSON() {},
				}) as DOMRect;
		}

		const found = findVisibleGuideHighlight(root, '[data-guide="panel"]');
		expect(found?.tagName).toBe('ASIDE');
	});

	it('rejects a rect that covers most of the viewport', () => {
		expect(
			isUsefulGuideSpotlightRect({
				width: 1200,
				height: 700,
				top: 0,
				left: 0,
				bottom: 700,
				right: 1200,
				x: 0,
				y: 0,
				toJSON() {},
			} as DOMRect)
		).toBe(false);
		expect(
			isUsefulGuideSpotlightRect({
				width: 240,
				height: 180,
				top: 40,
				left: 40,
				bottom: 220,
				right: 280,
				x: 40,
				y: 40,
				toJSON() {},
			} as DOMRect)
		).toBe(true);
	});
});
