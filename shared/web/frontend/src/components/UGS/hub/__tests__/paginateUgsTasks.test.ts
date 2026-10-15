/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */

import { describe, expect, it } from 'vitest';

import { paginateUgsTasks } from '../paginateUgsTasks';

describe('paginateUgsTasks', () => {
	it('returns first page slice', () => {
		const tasks = Array.from({ length: 25 }, (_, i) => ({
			id: `id-${i}`,
			type_key: 't',
			status: 'completed' as const,
			created_at: null,
			updated_at: null,
			user_id: 'u',
			priority: 5,
		}));
		const page = paginateUgsTasks(tasks, 1, 20);
		expect(page.items).toHaveLength(20);
		expect(page.totalPages).toBe(2);
		expect(page.hasPagination).toBe(true);
	});

	it('clamps page to valid range', () => {
		const tasks = [
			{
				id: 'a',
				type_key: 't',
				status: 'completed' as const,
				created_at: null,
				updated_at: null,
				user_id: 'u',
				priority: 5,
			},
		];
		const page = paginateUgsTasks(tasks, 99, 20);
		expect(page.page).toBe(1);
		expect(page.items).toHaveLength(1);
	});
});
