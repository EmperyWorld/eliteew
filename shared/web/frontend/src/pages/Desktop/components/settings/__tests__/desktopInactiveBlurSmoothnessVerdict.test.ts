/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for inactive blur smoothness verdict thresholds.
 *
 * Invariants:
 * - Verdict buckets stay stable for performance tab copy.
 *
 * Related:
 * - `desktopInactiveBlurSmoothnessVerdict.ts`
 */

import { describe, expect, it } from 'vitest';
import { computeInactiveBlurSmoothnessVerdict } from '../desktopInactiveBlurSmoothnessVerdict';

describe('computeInactiveBlurSmoothnessVerdict', () => {
	it('returns good for healthy samples', () => {
		expect(
			computeInactiveBlurSmoothnessVerdict({
				fps: 58,
				p95FrameMs: 20,
				longTaskCount: 0,
			})
		).toBe('good');
	});

	it('returns medium for moderate samples', () => {
		expect(
			computeInactiveBlurSmoothnessVerdict({
				fps: 50,
				p95FrameMs: 32,
				longTaskCount: 2,
			})
		).toBe('medium');
	});

	it('returns low for heavy samples', () => {
		expect(
			computeInactiveBlurSmoothnessVerdict({
				fps: 30,
				p95FrameMs: 55,
				longTaskCount: 6,
			})
		).toBe('low');
	});
});
