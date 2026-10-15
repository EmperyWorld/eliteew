import type { DesktopWindowStyle } from '@/types/profile';
import { describe, expect, it } from 'vitest';
import { desktopAccentRgbSpaceFromWindowStyle } from '../desktopAccentColor';

const ALL: DesktopWindowStyle[] = [
	'glass',
	'framed',
	'minimal',
	'noir',
	'neon',
	'paper',
	'aurora',
	'chameleon',
	'premium',
];

describe('desktopAccentRgbSpaceFromWindowStyle', () => {
	it('returns three space-separated integers for every window style', () => {
		for (const style of ALL) {
			const rgb = desktopAccentRgbSpaceFromWindowStyle(style);
			expect(rgb).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
			const parts = rgb.split(' ').map((x) => Number.parseInt(x, 10));
			for (const n of parts) {
				expect(n).toBeGreaterThanOrEqual(0);
				expect(n).toBeLessThanOrEqual(255);
			}
		}
	});

	it('premium uses gold channel values from frame preset', () => {
		expect(desktopAccentRgbSpaceFromWindowStyle('premium')).toBe('212 175 106');
	});

	it('paper uses warm brown from frame preset', () => {
		expect(desktopAccentRgbSpaceFromWindowStyle('paper')).toBe('139 90 43');
	});
});
