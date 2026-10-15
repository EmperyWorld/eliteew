/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for content download retry helper (404 race after async upload).
 *
 * Related:
 * - src/services/contentDownloadWithRetry.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.fn();

vi.mock('@/services/api/client', () => ({
	api: {
		get: (...args: unknown[]) => apiGet(...args),
	},
}));

import { fetchContentDownloadBlobWithRetry } from '@/services/contentDownloadWithRetry';

function httpError(status: number): Error & { response: { status: number } } {
	const err = new Error(`HTTP ${status}`) as Error & {
		response: { status: number };
	};
	err.response = { status };
	return err;
}

describe('fetchContentDownloadBlobWithRetry', () => {
	beforeEach(() => {
		apiGet.mockReset();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns blob on first success', async () => {
		const blob = new Blob(['ok'], { type: 'audio/mpeg' });
		apiGet.mockResolvedValueOnce(blob);
		const out = await fetchContentDownloadBlobWithRetry('id-1', {
			disposition: 'inline',
			v: 'unversioned',
		});
		expect(out).toBe(blob);
		expect(apiGet).toHaveBeenCalledTimes(1);
	});

	it('retries on 404 then succeeds', async () => {
		const blob = new Blob(['audio'], { type: 'audio/mpeg' });
		apiGet
			.mockRejectedValueOnce(httpError(404))
			.mockRejectedValueOnce(httpError(404))
			.mockResolvedValueOnce(blob);

		const promise = fetchContentDownloadBlobWithRetry(
			'73e1954d-b12c-4bbc-ba04-525c4e86952c',
			{ disposition: 'inline', v: 'unversioned' },
			{ initialDelayMs: 100, maxDelayMs: 1000 }
		);
		await vi.runAllTimersAsync();
		const out = await promise;
		expect(out).toBe(blob);
		expect(apiGet).toHaveBeenCalledTimes(3);
	});

	it('does not retry on 403', async () => {
		apiGet.mockRejectedValueOnce(httpError(403));
		await expect(
			fetchContentDownloadBlobWithRetry('id-1', {}, { maxAttempts: 5 })
		).rejects.toMatchObject({ response: { status: 403 } });
		expect(apiGet).toHaveBeenCalledTimes(1);
	});
});
