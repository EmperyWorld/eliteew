import type { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ewDeskFeedHasActiveUserScopedFilters } from '../ewDeskNewsQueryInvalidation';
import {
	EWDESK_NEWS_PAGED_SCOPE_ROOT,
	ewDeskNewsPagedInvalidationQueryKey,
} from '../ewDeskNewsQueryOptions';

describe('ewDeskFeedHasActiveUserScopedFilters', () => {
	it('returns false when no paged feed queries are cached', () => {
		const queryClient = {
			getQueriesData: vi.fn(() => []),
		} as unknown as QueryClient;
		expect(ewDeskFeedHasActiveUserScopedFilters(queryClient)).toBe(false);
	});

	it('returns true when a cached page uses unreadOnly', () => {
		const queryClient = {
			getQueriesData: vi.fn(() => [
				[[...EWDESK_NEWS_PAGED_SCOPE_ROOT, { unreadOnly: true }], null],
			]),
		} as unknown as QueryClient;
		expect(ewDeskFeedHasActiveUserScopedFilters(queryClient)).toBe(true);
		expect(queryClient.getQueriesData).toHaveBeenCalledWith({
			queryKey: ewDeskNewsPagedInvalidationQueryKey(),
		});
	});

	it('returns false when cached page only has search or pinned filters', () => {
		const queryClient = {
			getQueriesData: vi.fn(() => [
				[
					[...EWDESK_NEWS_PAGED_SCOPE_ROOT, { q: 'release', pinnedOnly: true }],
					null,
				],
			]),
		} as unknown as QueryClient;
		expect(ewDeskFeedHasActiveUserScopedFilters(queryClient)).toBe(false);
	});
});
