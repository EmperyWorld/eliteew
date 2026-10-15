import { describe, expect, it } from 'vitest';

import {
	nudgeLayoutItemSize,
	snapLayoutItemToIntegerGrid,
	snapLayoutToIntegerGrid,
} from '../gridLayoutSnap';

describe('gridLayoutSnap', () => {
	it('rounds fractional RGL coordinates and clamps to cols (C.28)', () => {
		const item = {
			i: 'a',
			x: 1.4,
			y: 2.6,
			w: 3.2,
			h: 2.1,
			minW: 2,
			minH: 2,
		};
		const s = snapLayoutItemToIntegerGrid(item, 12);
		expect(s).toMatchObject({ x: 1, y: 3, w: 3, h: 2 });
	});

	it('keeps tile within horizontal bounds', () => {
		const item = {
			i: 'b',
			x: 10,
			y: 0,
			w: 6,
			h: 2,
			minW: 2,
			minH: 2,
		};
		const s = snapLayoutItemToIntegerGrid(item, 12);
		expect(s.x + s.w).toBeLessThanOrEqual(12);
		expect(s.w).toBeGreaterThanOrEqual(2);
	});

	it('snapLayoutToIntegerGrid maps all items', () => {
		const layout = [{ i: '1', x: 0.1, y: 0, w: 2.9, h: 2, minW: 2, minH: 2 }];
		const out = snapLayoutToIntegerGrid(layout, 12);
		expect(out[0]).toMatchObject({ x: 0, w: 3 });
	});

	it('snapLayoutToIntegerGrid leaves empty layout unchanged (M.126)', () => {
		expect(snapLayoutToIntegerGrid([], 12)).toEqual([]);
	});

	it('nudgeLayoutItemSize respects min/max and static (C.29)', () => {
		const layout = [
			{
				i: 'x',
				x: 0,
				y: 0,
				w: 4,
				h: 4,
				minW: 3,
				minH: 3,
				maxW: 6,
				maxH: 8,
				static: false,
			},
		];
		const up = nudgeLayoutItemSize(layout, 'x', 1, 0, 12);
		expect(up?.[0]).toMatchObject({ w: 5 });

		const down = nudgeLayoutItemSize(layout, 'x', -10, 0, 12);
		expect(down?.[0]).toMatchObject({ w: 3 });

		const first = layout[0];
		expect(first).toBeDefined();
		if (!first) throw new Error('fixture');
		const locked = nudgeLayoutItemSize(
			[{ ...first, static: true }],
			'x',
			1,
			0,
			12
		);
		expect(locked).toBeNull();
	});
});
