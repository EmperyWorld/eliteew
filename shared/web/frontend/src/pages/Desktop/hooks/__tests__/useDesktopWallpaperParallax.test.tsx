import { describe, expect, it } from 'vitest';
import { computeWallpaperParallaxOffsetPct } from '../useDesktopWallpaperParallax';

describe('computeWallpaperParallaxOffsetPct', () => {
	it('scales offsets by scene depth', () => {
		expect(computeWallpaperParallaxOffsetPct(0.5, -0.25, 'soft')).toEqual({
			x: '0.625%',
			y: '-0.313%',
		});
		expect(computeWallpaperParallaxOffsetPct(0.5, -0.25, 'immersive')).toEqual({
			x: '2.000%',
			y: '-1.000%',
		});
	});
});
