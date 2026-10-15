import { describe, expect, it } from 'vitest';

import { hexToRgba } from './diagnosticChartColors';

describe('hexToRgba', () => {
	it('converts 6-digit hex to rgba', () => {
		expect(hexToRgba('#FF6B35', 0.5)).toBe('rgba(255,107,53,0.5)');
	});

	it('returns original on invalid input', () => {
		expect(hexToRgba('bad', 0.5)).toBe('bad');
	});
});
