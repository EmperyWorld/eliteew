import { describe, expect, it } from 'vitest';

import {
	parseSortSelectValue,
	sortSelectValue,
} from '../dashboardWidgetListSort';

describe('dashboardWidgetListSort', () => {
	it('sortSelectValue maps auto and field:direction', () => {
		expect(sortSelectValue(undefined)).toBe('auto');
		expect(sortSelectValue('auto')).toBe('auto');
		expect(sortSelectValue({ field: 'due_at', direction: 'asc' })).toBe(
			'due_at:asc'
		);
		expect(sortSelectValue({ field: 'updated_at', direction: 'desc' })).toBe(
			'updated_at:desc'
		);
	});

	it('parseSortSelectValue round-trips', () => {
		expect(parseSortSelectValue('auto')).toBeUndefined();
		expect(parseSortSelectValue('name:desc')).toEqual({
			field: 'name',
			direction: 'desc',
		});
	});
});
