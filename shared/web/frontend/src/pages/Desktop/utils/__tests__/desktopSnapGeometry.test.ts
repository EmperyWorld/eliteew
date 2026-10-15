import { describe, expect, it } from 'vitest';
import { getRectForSnapZone } from '../desktopSnapGeometry';

describe('getRectForSnapZone', () => {
	const work = { width: 1200, height: 800 };

	it('matches halves and thirds width', () => {
		const left = getRectForSnapZone('left', work);
		expect(left.size.width).toBe(600);
		expect(left.position).toEqual({ x: 0, y: 0 });

		const right = getRectForSnapZone('right', work);
		expect(right.position.x).toBe(600);
		expect(right.size.width).toBe(600);

		const third = 400;
		expect(getRectForSnapZone('left-third', work).size.width).toBe(third);
		expect(getRectForSnapZone('center-third', work).position.x).toBe(third);
		expect(getRectForSnapZone('right-third', work).position.x).toBe(800);
	});

	it('marks top zone as maximized', () => {
		expect(getRectForSnapZone('top', work).isMaximized).toBe(true);
		expect(getRectForSnapZone('left', work).isMaximized).toBe(false);
	});

	it('lays out quarter grid', () => {
		const tl = getRectForSnapZone('top-left', work);
		expect(tl.size).toEqual({ width: 600, height: 400 });
		const br = getRectForSnapZone('bottom-right', work);
		expect(br.position).toEqual({ x: 600, y: 400 });
	});
});
