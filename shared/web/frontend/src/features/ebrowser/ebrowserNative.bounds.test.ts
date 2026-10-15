/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock EBrowser stage bounds helper (Meet-pattern host rect).
 *
 * Related:
 * - features/ebrowser/ebrowserNative.ts
 */

import { describe, expect, it } from 'vitest';
import { ebrowserStageBoundsFromElement } from './ebrowserNative';

describe('ebrowserStageBoundsFromElement', () => {
	it('returns null for null element', () => {
		expect(ebrowserStageBoundsFromElement(null)).toBeNull();
	});

	it('maps getBoundingClientRect to bounds', () => {
		const el = {
			getBoundingClientRect: () => ({
				x: 10,
				y: 20,
				width: 800,
				height: 600,
				top: 20,
				left: 10,
				bottom: 620,
				right: 810,
				toJSON: () => ({}),
			}),
		} as unknown as Element;
		expect(ebrowserStageBoundsFromElement(el)).toEqual({
			x: 10,
			y: 20,
			width: 800,
			height: 600,
		});
	});
});
