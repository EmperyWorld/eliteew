import { describe, expect, it } from 'vitest';
import {
	getDesktopWindowContentVariants,
	getDesktopWindowFrameVariants,
} from '../desktopWindowMotionVariants';
import { DESKTOP_WINDOW_MINIMIZE_MS } from '../desktopShellMotion';

describe('getDesktopWindowFrameVariants', () => {
	it('uses near-instant transitions without spring when reduced motion', () => {
		const v = getDesktopWindowFrameVariants(true);
		expect(v.animate).toMatchObject({
			opacity: 1,
			scale: 1,
			y: 0,
			transition: { duration: 0.01 },
		});
		expect(v.minimized).toMatchObject({
			opacity: 0,
			scale: 0.88,
			y: 24,
		});
	});

	it('uses shell spring open and minimize animation when motion is allowed', () => {
		const v = getDesktopWindowFrameVariants(false);
		expect(v.animate).toMatchObject({
			opacity: 1,
			scale: 1,
			y: 0,
			transition: { duration: DESKTOP_WINDOW_MINIMIZE_MS / 1000 },
		});
		expect(v.minimized).toMatchObject({
			opacity: 0,
			scale: 0.82,
			y: 48,
		});
	});
});

describe('getDesktopWindowContentVariants', () => {
	it('drops content stagger when reduced motion', () => {
		const reduced = getDesktopWindowContentVariants(true);
		expect(reduced.animate).toMatchObject({
			transition: { duration: 0.01 },
		});
	});

	it('uses fade delay for inner chrome when motion is allowed', () => {
		const full = getDesktopWindowContentVariants(false);
		expect(full.animate).toMatchObject({
			transition: expect.objectContaining({ delay: 0.04 }),
		});
	});
});
