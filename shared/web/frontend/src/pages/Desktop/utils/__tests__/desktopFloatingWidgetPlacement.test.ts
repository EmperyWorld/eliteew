/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for floating widget placement vs desktop icon reserved viewport bounds.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - `../desktopFloatingWidgetPlacement.ts`
 */

import { describe, expect, it } from 'vitest';
import type { DesktopWorkArea } from '../desktopSnapGeometry';
import {
	computeDesktopIconReservedViewportBounds,
	resolveFloatingWidgetViewportPosition,
} from '../desktopFloatingWidgetPlacement';

const workArea: DesktopWorkArea = {
	offsetLeft: 0,
	offsetTop: 0,
	width: 1280,
	height: 800,
	layoutScale: 1,
};

describe('computeDesktopIconReservedViewportBounds', () => {
	it('returns null when there are no icons', () => {
		expect(
			computeDesktopIconReservedViewportBounds([], 'medium', workArea)
		).toBeNull();
	});

	it('extends to the rightmost and bottommost icon edges', () => {
		const bounds = computeDesktopIconReservedViewportBounds(
			[
				{ position: { x: 20, y: 20 } },
				{ position: { x: 20, y: 130 } },
				{ position: { x: 120, y: 20 } },
			],
			'medium',
			workArea,
			8
		);
		expect(bounds).not.toBeNull();
		expect(bounds?.left).toBe(0);
		expect(bounds?.top).toBe(0);
		expect(bounds?.right).toBe(120 + 100 + 8);
		expect(bounds?.bottom).toBe(130 + 110 + 8);
	});
});

describe('resolveFloatingWidgetViewportPosition', () => {
	const viewport = {
		width: 1346,
		height: 908,
		taskbarPx: 48,
		pad: 8,
	};

	it('clamps into viewport margins', () => {
		const result = resolveFloatingWidgetViewportPosition({
			x: 5000,
			y: 5000,
			widgetWidth: 300,
			widgetHeight: 120,
			viewport,
		});
		expect(result.x).toBeLessThan(5000);
		expect(result.y).toBeLessThan(5000);
	});

	it('nudges widget out of icon reserved zone', () => {
		const iconReserved = {
			left: 0,
			top: 0,
			right: 320,
			bottom: 400,
		};
		const result = resolveFloatingWidgetViewportPosition({
			x: 40,
			y: 40,
			widgetWidth: 300,
			widgetHeight: 120,
			viewport,
			iconReserved,
		});
		const overlaps =
			result.x < iconReserved.right &&
			result.x + 300 > iconReserved.left &&
			result.y < iconReserved.bottom &&
			result.y + 120 > iconReserved.top;
		expect(overlaps).toBe(false);
	});
});
