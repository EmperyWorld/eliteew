/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for coalesced Hub page fetch helper.
 *
 * Related:
 * - services/api/ugs/ugsHubCoalescedFetchNextPage.ts
 */

import { describe, expect, it, vi } from 'vitest';

import { createCoalescedFetchNextPage } from '../ugsHubCoalescedFetchNextPage';

describe('createCoalescedFetchNextPage', () => {
	it('merges parallel fetchNextPage calls into one invocation', async () => {
		const fetchNextPage = vi
			.fn()
			.mockImplementation(
				() => new Promise((resolve) => setTimeout(resolve, 20))
			);
		const coalesced = createCoalescedFetchNextPage(fetchNextPage);

		const first = coalesced();
		const second = coalesced();

		expect(first).toBe(second);
		await first;
		expect(fetchNextPage).toHaveBeenCalledTimes(1);
	});

	it('allows a new fetch after the previous promise settles', async () => {
		const fetchNextPage = vi.fn().mockResolvedValue(undefined);
		const coalesced = createCoalescedFetchNextPage(fetchNextPage);

		await coalesced();
		await coalesced();

		expect(fetchNextPage).toHaveBeenCalledTimes(2);
	});
});
