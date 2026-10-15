/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for music-scoped Unified Content Range download helpers.
 *
 * Related:
 * - src/pages/MusicPlayer/musicPlayerAudioDownload.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { apiFetchWithAuth, createContentDownloadTicket } = vi.hoisted(() => ({
	apiFetchWithAuth: vi.fn(),
	createContentDownloadTicket: vi.fn(),
}));

vi.mock('@/services/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@/services/api/client')>();
	return {
		...actual,
		apiFetchWithAuth: (...args: unknown[]) => apiFetchWithAuth(...args),
	};
});

vi.mock('@/services/contentApi', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@/services/contentApi')>();
	return {
		...actual,
		contentApi: {
			...actual.contentApi,
			createContentDownloadTicket: (...args: unknown[]) =>
				createContentDownloadTicket(...args),
			downloadContentToBrowser: vi.fn(),
		},
	};
});

import {
	fetchMusicContentDownloadBlobWithRanges,
	parseUnifiedContentIdFromDownloadPath,
	readMusicContentDownloadParamsFromPath,
	resolveMusicContentInlineStreamUrl,
	resolveMusicPlayerTrackInlineStreamUrl,
} from '../musicPlayerAudioDownload';

function mockRangeResponse(input: {
	status: number;
	body: ArrayBuffer;
	contentRange?: string | null;
	contentType?: string;
	acceptRanges?: string | null;
}): Response {
	return new Response(input.body, {
		status: input.status,
		headers: {
			...(input.contentRange ? { 'Content-Range': input.contentRange } : {}),
			'Content-Type': input.contentType ?? 'audio/mpeg',
			...(input.acceptRanges ? { 'Accept-Ranges': input.acceptRanges } : {}),
		},
	});
}

describe('musicPlayerAudioDownload', () => {
	beforeEach(() => {
		apiFetchWithAuth.mockReset();
		createContentDownloadTicket.mockReset();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('parses unified content download paths', () => {
		expect(
			parseUnifiedContentIdFromDownloadPath(
				'/api/v1/content/11111111-1111-1111-1111-111111111111/download?disposition=inline&v=v1'
			)
		).toEqual({
			contentId: '11111111-1111-1111-1111-111111111111',
			searchParams: new URLSearchParams('disposition=inline&v=v1'),
		});
		expect(
			readMusicContentDownloadParamsFromPath(
				'/api/v1/content/11111111-1111-1111-1111-111111111111/download?disposition=attachment'
			)
		).toEqual({
			disposition: 'attachment',
			version: null,
		});
	});

	it('resolves inline stream URLs from download tickets', async () => {
		createContentDownloadTicket.mockResolvedValueOnce({
			download_url:
				'/api/v1/content/11111111-1111-1111-1111-111111111111/download-by-ticket?ticket=t1',
			expires_in_seconds: 120,
		});

		await expect(
			resolveMusicContentInlineStreamUrl(
				'11111111-1111-1111-1111-111111111111',
				{ version: 'v1' }
			)
		).resolves.toContain('/download-by-ticket?ticket=t1');
		expect(createContentDownloadTicket).toHaveBeenCalledWith(
			'11111111-1111-1111-1111-111111111111',
			{ disposition: 'inline', revision: 'v1' }
		);
	});

	it('resolveMusicPlayerTrackInlineStreamUrl honors explicit version on track', async () => {
		createContentDownloadTicket.mockResolvedValueOnce({
			download_url: '/api/v1/content/track-1/download-by-ticket?ticket=t2',
			expires_in_seconds: 120,
		});

		await expect(
			resolveMusicPlayerTrackInlineStreamUrl({
				id: 'track-1',
				updated_at: 'ignored',
				file_size: 99,
				version: 'explicit-rev',
			})
		).resolves.toContain('ticket=t2');
		expect(createContentDownloadTicket).toHaveBeenCalledWith('track-1', {
			disposition: 'inline',
			revision: 'explicit-rev',
		});
	});

	it('assembles blobs from 206 range slices', async () => {
		apiFetchWithAuth
			.mockResolvedValueOnce(
				mockRangeResponse({
					status: 206,
					body: new Uint8Array([1]).buffer,
					contentRange: 'bytes 0-0/6',
				})
			)
			.mockResolvedValueOnce(
				mockRangeResponse({
					status: 206,
					body: new Uint8Array([1, 2, 3, 4, 5]).buffer,
					contentRange: 'bytes 0-4/6',
				})
			)
			.mockResolvedValueOnce(
				mockRangeResponse({
					status: 206,
					body: new Uint8Array([6]).buffer,
					contentRange: 'bytes 5-5/6',
				})
			);

		const blob = await fetchMusicContentDownloadBlobWithRanges(
			'11111111-1111-1111-1111-111111111111',
			{ disposition: 'inline' },
			{ chunkBytes: 5 }
		);

		expect(blob.size).toBe(6);
		expect(apiFetchWithAuth).toHaveBeenCalledTimes(3);
		expect(apiFetchWithAuth.mock.calls[0]?.[1]).toMatchObject({
			headers: { Range: 'bytes=0-0' },
		});
		expect(apiFetchWithAuth.mock.calls[1]?.[1]).toMatchObject({
			headers: { Range: 'bytes=0-4' },
		});
		expect(apiFetchWithAuth.mock.calls[2]?.[1]).toMatchObject({
			headers: { Range: 'bytes=5-5' },
		});
	});

	it('returns full body when server ignores Range with 200', async () => {
		const body = new Uint8Array([9, 8, 7]).buffer;
		apiFetchWithAuth.mockResolvedValueOnce(
			mockRangeResponse({
				status: 200,
				body,
				acceptRanges: 'bytes',
			})
		);

		const blob = await fetchMusicContentDownloadBlobWithRanges('content-1');
		expect(blob.size).toBe(3);
		expect(apiFetchWithAuth).toHaveBeenCalledTimes(1);
	});

	it('retries probe on 404 before succeeding with 206', async () => {
		apiFetchWithAuth
			.mockResolvedValueOnce(
				mockRangeResponse({
					status: 404,
					body: new ArrayBuffer(0),
				})
			)
			.mockResolvedValueOnce(
				mockRangeResponse({
					status: 206,
					body: new Uint8Array([1, 2]).buffer,
					contentRange: 'bytes 0-1/2',
				})
			)
			.mockResolvedValueOnce(
				mockRangeResponse({
					status: 206,
					body: new Uint8Array([1, 2]).buffer,
					contentRange: 'bytes 0-1/2',
				})
			);

		const promise = fetchMusicContentDownloadBlobWithRanges(
			'11111111-1111-1111-1111-111111111111',
			{},
			{ initialDelayMs: 100, maxDelayMs: 1000, chunkBytes: 2 }
		);
		await vi.runAllTimersAsync();
		const blob = await promise;
		expect(blob.size).toBe(2);
		expect(apiFetchWithAuth).toHaveBeenCalledTimes(3);
	});
});
