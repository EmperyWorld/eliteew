/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for Marketing AI job center dropdown fixed positioning.
 *
 * Related:
 * - components/MarketingAiJobCenter.tsx
 */
import { describe, expect, it } from 'vitest';

import { computeMarketingAiJobCenterPanelStyle } from '../utils/marketingAiJobCenterPanelPosition';

describe('computeMarketingAiJobCenterPanelStyle', () => {
	it('anchors panel below trigger with right edge aligned', () => {
		const style = computeMarketingAiJobCenterPanelStyle(
			{
				top: 100,
				bottom: 132,
				left: 900,
				right: 1020,
				width: 120,
				height: 32,
			} as DOMRect,
			500,
			{ innerWidth: 1200, innerHeight: 800 } as Window
		);
		expect(style.top).toBe(138);
		expect(style.left).toBe(668);
		expect(style.width).toBe(352);
		expect(style.zIndex).toBe(500);
	});

	it('keeps panel inside viewport on narrow screens', () => {
		const style = computeMarketingAiJobCenterPanelStyle(
			{
				top: 50,
				bottom: 82,
				left: 280,
				right: 360,
				width: 80,
				height: 32,
			} as DOMRect,
			200,
			{ innerWidth: 390, innerHeight: 700 } as Window
		);
		expect(style.left).toBeGreaterThanOrEqual(10);
		expect(style.width).toBeLessThanOrEqual(370);
	});
});
