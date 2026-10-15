import { describe, expect, it } from 'vitest';
import { computeGridColumnCountFromWidth } from '../utils/contentManagerFilesGridLayout';

describe('computeGridColumnCountFromWidth', () => {
	it('returns 1 for non-positive width', () => {
		expect(computeGridColumnCountFromWidth(0, false)).toBe(1);
		expect(computeGridColumnCountFromWidth(-10, false)).toBe(1);
	});

	it('uses mobile breakpoints', () => {
		expect(computeGridColumnCountFromWidth(400, true)).toBe(1);
		expect(computeGridColumnCountFromWidth(700, true)).toBe(2);
	});

	it('derives desktop columns from 11rem track + gap-3', () => {
		// 176 + 12 = 188 per track; 400px -> floor((400+12)/188) = 2
		expect(computeGridColumnCountFromWidth(400, false)).toBe(2);
		expect(computeGridColumnCountFromWidth(800, false)).toBe(4);
	});
});
