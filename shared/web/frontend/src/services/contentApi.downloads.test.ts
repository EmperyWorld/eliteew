/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Focused contracts for Unified Content browser download helpers.
 *
 * Invariants:
 * - Ticket success probes direct URL then navigates; probe/ticket failure falls back to Blob helper.
 * - Terminal blob failures surface `notify.error` (403 → Access Denied, network → Download Failed).
 *
 * Related:
 * - src/services/contentApi/
 * - utils/browserDownload.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiClientPost = vi.hoisted(() => vi.fn());
const apiClientGet = vi.hoisted(() => vi.fn());
const apiPost = vi.hoisted(() => vi.fn());
const triggerBrowserDownloadFromBlob = vi.hoisted(() => vi.fn());
const triggerBrowserDownloadFromUrl = vi.hoisted(() => vi.fn());
const notifyError = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock('./api', () => ({
	api: {
		get: vi.fn(),
		post: apiPost,
		put: vi.fn(),
		patch: vi.fn(),
		delete: vi.fn(),
	},
	apiClient: {
		get: apiClientGet,
		post: apiClientPost,
	},
}));

vi.mock('../utils/browserDownload', () => ({
	triggerBrowserDownloadFromBlob,
	triggerBrowserDownloadFromUrl,
}));

vi.mock('@/notifications', () => ({
	notify: {
		error: notifyError,
	},
}));

function mockDirectDownloadProbeSuccess(): void {
	fetchMock.mockResolvedValue({
		ok: true,
		status: 206,
	});
}

describe('contentApi browser downloads', () => {
	beforeEach(() => {
		apiClientGet.mockReset();
		apiClientPost.mockReset();
		apiPost.mockReset();
		triggerBrowserDownloadFromBlob.mockReset();
		triggerBrowserDownloadFromUrl.mockReset();
		notifyError.mockReset();
		fetchMock.mockReset();
		vi.stubGlobal('fetch', fetchMock);
		mockDirectDownloadProbeSuccess();
	});

	it('downloadContentToBrowser uses a direct ticket URL without fetching Blob bytes', async () => {
		const { contentApi } = await import('./contentApi');
		apiPost.mockResolvedValueOnce({
			download_url: '/api/v1/content/content-1/download-by-ticket?ticket=t1',
			expires_in_seconds: 120,
		});

		await contentApi.downloadContentToBrowser({
			contentId: 'content-1',
			preferredFilename: 'report.pdf',
		});

		expect(apiPost).toHaveBeenCalledWith(
			'/content/content-1/download-ticket',
			{ disposition: 'attachment', v: null },
			expect.objectContaining({ baseURL: '/api/v1' })
		);
		expect(triggerBrowserDownloadFromUrl).toHaveBeenCalledWith(
			expect.stringContaining(
				'/api/v1/content/content-1/download-by-ticket?ticket=t1'
			),
			{ download: 'report.pdf' }
		);
		expect(fetchMock).toHaveBeenCalled();
		expect(apiClientGet).not.toHaveBeenCalled();
		expect(triggerBrowserDownloadFromBlob).not.toHaveBeenCalled();
	});

	it('downloadContentToBrowser shows Access Denied toast when blob download returns 403', async () => {
		const { AxiosError } = await import('axios');
		const { contentApi } = await import('./contentApi');
		const forbidden = new AxiosError('Request failed with status code 403');
		forbidden.response = {
			status: 403,
			data: { detail: 'Forbidden' },
			statusText: 'Forbidden',
			headers: {},
			config: { headers: {} as import('axios').AxiosRequestHeaders },
		};
		forbidden.request = {};

		apiPost.mockRejectedValueOnce(new Error('redis unavailable'));
		apiClientGet.mockRejectedValueOnce(forbidden);

		await expect(
			contentApi.downloadContentToBrowser({
				contentId: 'content-1',
				preferredFilename: 'report.pdf',
			})
		).rejects.toBe(forbidden);

		expect(notifyError).toHaveBeenCalledWith(
			'Download failed',
			'Access Denied',
			expect.objectContaining({ duration: 5000 })
		);
		expect(triggerBrowserDownloadFromBlob).not.toHaveBeenCalled();
	});

	it('downloadContentToBrowser shows Download Failed toast on network error', async () => {
		const { AxiosError } = await import('axios');
		const { contentApi } = await import('./contentApi');
		const networkError = new AxiosError('Network Error');
		networkError.request = {};

		apiPost.mockRejectedValueOnce(new Error('redis unavailable'));
		apiClientGet.mockRejectedValueOnce(networkError);

		await expect(
			contentApi.downloadContentToBrowser({
				contentId: 'content-1',
				preferredFilename: 'report.pdf',
			})
		).rejects.toBe(networkError);

		expect(notifyError).toHaveBeenCalledWith(
			'Download failed',
			'Download Failed',
			expect.objectContaining({ duration: 5000 })
		);
		expect(triggerBrowserDownloadFromBlob).not.toHaveBeenCalled();
	});

	it('downloadContentToBrowser falls back to blob when direct probe returns 403', async () => {
		const { contentApi } = await import('./contentApi');
		const blob = new Blob(['file'], { type: 'application/pdf' });

		apiPost.mockResolvedValueOnce({
			download_url: '/api/v1/content/content-1/download-by-ticket?ticket=t1',
			expires_in_seconds: 120,
		});
		fetchMock.mockResolvedValueOnce({
			ok: false,
			status: 403,
		});
		apiClientGet.mockResolvedValueOnce({
			data: blob,
			headers: {
				'content-disposition': "attachment; filename*=UTF-8''report.pdf",
			},
		});

		await contentApi.downloadContentToBrowser({
			contentId: 'content-1',
			preferredFilename: 'report.pdf',
		});

		expect(apiClientGet).toHaveBeenCalled();
		expect(triggerBrowserDownloadFromBlob).toHaveBeenCalledWith(
			blob,
			'report.pdf'
		);
		expect(notifyError).not.toHaveBeenCalled();
	});

	it('downloadOwnedArchive falls back to Blob helper when ticket mint fails', async () => {
		const { contentApi } = await import('./contentApi');
		const blob = new Blob(['zip'], { type: 'application/zip' });
		apiClientPost.mockRejectedValueOnce(new Error('redis unavailable'));
		apiClientPost.mockResolvedValueOnce({
			data: blob,
			headers: {
				'content-disposition': "attachment; filename*=UTF-8''owned_content.zip",
			},
		});

		await contentApi.downloadOwnedArchive();

		expect(apiClientPost).toHaveBeenNthCalledWith(
			1,
			'/api/v1/content/download-owned-archive-ticket',
			{ archive_name: null }
		);
		expect(apiClientPost).toHaveBeenCalledWith(
			'/api/v1/content/download-owned-archive',
			{},
			{ responseType: 'blob', timeout: 0 }
		);
		expect(triggerBrowserDownloadFromBlob).toHaveBeenCalledWith(
			blob,
			'owned_content.zip'
		);
	});

	it('downloadVersion uses direct URL when ticket mint succeeds', async () => {
		const { contentApi } = await import('./contentApi');
		apiClientPost.mockResolvedValueOnce({
			data: {
				download_url:
					'/api/v1/content/versions/version-1/download-by-ticket?ticket=t2',
				expires_in_seconds: 120,
			},
		});

		await contentApi.downloadVersion('version-1', 'fallback.txt');

		expect(apiClientPost).toHaveBeenCalledWith(
			'/api/v1/content/versions/version-1/download-ticket',
			{}
		);
		expect(triggerBrowserDownloadFromUrl).toHaveBeenCalledWith(
			expect.stringContaining(
				'/api/v1/content/versions/version-1/download-by-ticket?ticket=t2'
			),
			{ download: 'fallback.txt' }
		);
		expect(apiClientGet).not.toHaveBeenCalled();
	});

	it('downloadVersion falls back to Blob helper with fallback filename', async () => {
		const { contentApi } = await import('./contentApi');
		const blob = new Blob(['version'], { type: 'text/plain' });
		apiClientPost.mockRejectedValueOnce(new Error('redis unavailable'));
		apiClientGet.mockResolvedValueOnce({
			data: blob,
			headers: {},
		});

		await contentApi.downloadVersion('version-1', 'fallback.txt');

		expect(apiClientGet).toHaveBeenCalledWith(
			'/api/v1/content/versions/version-1/download',
			expect.objectContaining({ responseType: 'blob', timeout: 0 })
		);
		expect(triggerBrowserDownloadFromBlob).toHaveBeenCalledWith(
			blob,
			'fallback.txt'
		);
	});
});
