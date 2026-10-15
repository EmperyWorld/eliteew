/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for conditionalJsonGet ETag cache + cache invalidation observability.
 *
 * Invariants:
 * - Mocks apiClient and cacheInvalidationLogger only; no network.
 *
 * Related:
 * - `services/api/conditionalJsonGet.ts`, `services/api/cacheInvalidationLogger.ts`
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, logCacheInvalidationMock } = vi.hoisted(() => ({
	mockGet: vi.fn(),
	logCacheInvalidationMock: vi.fn(),
}));

vi.mock('../client', () => ({
	apiClient: {
		get: mockGet,
	},
}));

vi.mock('../cacheInvalidationLogger', () => ({
	logCacheInvalidation: logCacheInvalidationMock,
}));

import { apiClient } from '../client';
import {
	clearFeSessionApiCaches,
	conditionalJsonGet,
	invalidateConditionalJsonKey,
	updateConditionalJsonCache,
} from '../conditionalJsonGet';

describe('conditionalJsonGet', () => {
	beforeEach(() => {
		mockGet.mockReset();
		logCacheInvalidationMock.mockReset();
		invalidateConditionalJsonKey('t:conditional');
	});

	it('returns data on 200 and stores etag', async () => {
		mockGet.mockResolvedValueOnce({
			status: 200,
			data: { n: 1 },
			headers: { etag: '"e1"' },
		});
		const r = await conditionalJsonGet<{ n: number }>(
			't:conditional',
			'/z',
			{}
		);
		expect(r).toEqual({ n: 1 });
	});

	it('sends If-None-Match and returns cached JSON on 304', async () => {
		mockGet
			.mockResolvedValueOnce({
				status: 200,
				data: { n: 2 },
				headers: { etag: '"etag2"' },
			})
			.mockResolvedValueOnce({
				status: 304,
				data: '',
				headers: {},
			});
		await conditionalJsonGet<{ n: number }>('t:conditional', '/z', {});
		const r = await conditionalJsonGet<{ n: number }>(
			't:conditional',
			'/z',
			{}
		);
		expect(r).toEqual({ n: 2 });
		const secondConfig = mockGet.mock.calls[1]?.[1] as
			| { headers?: Record<string, string> }
			| undefined;
		expect(secondConfig?.headers?.['If-None-Match']).toBe('"etag2"');
		expect(apiClient.get).toHaveBeenCalledTimes(2);
		expect(logCacheInvalidationMock).toHaveBeenCalledWith(
			'conditionalJsonGet 304 short-circuit',
			expect.objectContaining({
				cacheKey: 't:conditional',
				url: '/z',
			})
		);
	});

	it('retries without If-None-Match when 304 arrives without cached body', async () => {
		updateConditionalJsonCache('t:conditional', undefined, '"etag3"');
		mockGet
			.mockResolvedValueOnce({
				status: 304,
				data: '',
				headers: {},
			})
			.mockResolvedValueOnce({
				status: 200,
				data: { n: 4 },
				headers: { etag: '"etag4"' },
			});

		const r = await conditionalJsonGet<{ n: number }>(
			't:conditional',
			'/z',
			{}
		);

		expect(r).toEqual({ n: 4 });
		expect(logCacheInvalidationMock).toHaveBeenCalledWith(
			'conditionalJsonGet etag desync retry',
			expect.objectContaining({
				cacheKey: 't:conditional',
				url: '/z',
			})
		);
	});

	it('clearFeSessionApiCaches logs via ServiceLogger helper', async () => {
		mockGet.mockResolvedValueOnce({
			status: 200,
			data: { n: 9 },
			headers: { etag: '"e9"' },
		});
		await conditionalJsonGet<{ n: number }>('t:conditional', '/z', {});

		clearFeSessionApiCaches();

		expect(logCacheInvalidationMock).toHaveBeenCalledWith(
			'clearFeSessionApiCaches',
			expect.objectContaining({ clearedKeys: 1 })
		);
	});
});
