import { describe, expect, it } from 'vitest';

import { marketingCanvasPersistKey } from '../widgets/marketingCanvasPersistKey';

import {
	countTldrawPages,
	countTldrawShapeRecords,
	MAX_TLDRAW_PAGE_COUNT,
	MAX_TLDRAW_SHAPE_RECORDS,
} from '../drawingSnapshotMetrics';

describe('drawingSnapshotMetrics', () => {
	it('counts shape records in document.records (legacy tldraw)', () => {
		const snap = {
			document: {
				records: {
					a: { typeName: 'page' },
					b: { typeName: 'shape' },
					c: { typeName: 'shape' },
				},
			},
		} as unknown as Record<string, unknown>;
		expect(countTldrawShapeRecords(snap)).toBe(2);
	});

	it('counts non-deleted elements in ewExcali payload', () => {
		const snap = {
			[marketingCanvasPersistKey]: {
				elements: [
					{ id: '1', type: 'rectangle' },
					{ id: '2', type: 'rectangle', isDeleted: true },
				],
			},
		} as Record<string, unknown>;
		expect(countTldrawShapeRecords(snap)).toBe(1);
		expect(countTldrawPages(snap)).toBe(1);
	});

	it('exports a finite cap constant', () => {
		expect(MAX_TLDRAW_SHAPE_RECORDS).toBeGreaterThan(0);
	});

	it('counts page records in document.records', () => {
		const snap = {
			document: {
				records: {
					p1: { typeName: 'page' },
					p2: { typeName: 'page' },
					s1: { typeName: 'shape' },
				},
			},
		} as unknown as Record<string, unknown>;
		expect(countTldrawPages(snap)).toBe(2);
	});

	it('exports page cap constant', () => {
		expect(MAX_TLDRAW_PAGE_COUNT).toBeGreaterThan(0);
	});
});
