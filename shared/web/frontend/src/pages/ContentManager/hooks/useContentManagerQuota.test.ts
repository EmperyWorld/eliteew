/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for useContentManagerQuota — maps GET /content/quota/me without hardcoded limits.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { contentApi } from '../../../services/contentApi';
import { useContentManagerQuota } from './useContentManagerQuota';

vi.mock('../../../services/contentApi', () => ({
	contentApi: {
		getQuotaMe: vi.fn(),
	},
}));

const mockedGetQuotaMe = vi.mocked(contentApi.getQuotaMe);

describe('useContentManagerQuota', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('loads quota bytes from contentApi.getQuotaMe', async () => {
		const limit = 25 * 1024 * 1024 * 1024;
		const used = 3 * 1024 * 1024 * 1024;
		mockedGetQuotaMe.mockResolvedValue({
			bytes_used: used,
			quota_bytes: limit,
			bytes_remaining: limit - used,
		});

		const { result } = renderHook(() => useContentManagerQuota());

		await waitFor(() => {
			expect(result.current.quotaLoading).toBe(false);
		});

		expect(result.current.quotaBytesUsed).toBe(used);
		expect(result.current.quotaBytesLimit).toBe(limit);
		expect(result.current.quotaError).toBeNull();
	});

	it('surfaces fetch errors without falling back to a hardcoded limit', async () => {
		mockedGetQuotaMe.mockRejectedValue(new Error('quota unavailable'));

		const { result } = renderHook(() => useContentManagerQuota());

		await waitFor(() => {
			expect(result.current.quotaLoading).toBe(false);
		});

		expect(result.current.quotaBytesUsed).toBeNull();
		expect(result.current.quotaBytesLimit).toBeNull();
		expect(result.current.quotaError).toBe('quota unavailable');
	});
});
