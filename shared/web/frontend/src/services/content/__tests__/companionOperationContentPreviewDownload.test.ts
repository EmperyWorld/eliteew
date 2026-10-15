/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for companion operation content preview download guard (404 dedupe).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { APIError } from '@/services/api/client';
import { contentApi } from '@/services/contentApi';
import {
	clearCompanionOperationContentPreviewDownloadGuard,
	downloadCompanionOperationImageBlob,
	isCompanionOperationContentKnownMissing,
	resetCompanionOperationContentPreviewDownloadGuardForTests,
} from '@/services/content/companionOperationContentPreviewDownload';

vi.mock('@/services/contentApi', () => ({
	contentApi: {
		downloadContentBlob: vi.fn(),
	},
}));

const CONTENT_ID = '970e23a2-b9aa-42ff-9dee-acccf0c0b8ba';

afterEach(() => {
	resetCompanionOperationContentPreviewDownloadGuardForTests();
	vi.clearAllMocks();
});

describe('companionOperationContentPreviewDownload', () => {
	it('marks content id missing after 404 and skips subsequent network calls', async () => {
		vi.mocked(contentApi.downloadContentBlob).mockRejectedValue(
			new APIError('Not found', 404, 'NOT_FOUND')
		);

		await expect(
			downloadCompanionOperationImageBlob(CONTENT_ID)
		).rejects.toMatchObject({
			statusCode: 404,
		});
		expect(contentApi.downloadContentBlob).toHaveBeenCalledTimes(1);
		expect(isCompanionOperationContentKnownMissing(CONTENT_ID)).toBe(true);

		await expect(
			downloadCompanionOperationImageBlob(CONTENT_ID)
		).rejects.toMatchObject({
			statusCode: 404,
		});
		expect(contentApi.downloadContentBlob).toHaveBeenCalledTimes(1);
	});

	it('dedupes concurrent downloads for the same content id', async () => {
		let resolveDownload = (_value: { blob: Blob; filename?: string }) => {};
		const pending = new Promise<{ blob: Blob; filename?: string }>(
			(resolve) => {
				resolveDownload = resolve;
			}
		);
		vi.mocked(contentApi.downloadContentBlob).mockReturnValue(pending);

		const first = downloadCompanionOperationImageBlob(CONTENT_ID);
		const second = downloadCompanionOperationImageBlob(CONTENT_ID);
		expect(contentApi.downloadContentBlob).toHaveBeenCalledTimes(1);

		resolveDownload({ blob: new Blob(['x'], { type: 'image/png' }) });
		await expect(first).resolves.toBeDefined();
		await expect(second).resolves.toBeDefined();
	});

	it('clearCompanionOperationContentPreviewDownloadGuard resets missing cache', async () => {
		vi.mocked(contentApi.downloadContentBlob).mockRejectedValue(
			new APIError('Not found', 404, 'NOT_FOUND')
		);
		await expect(
			downloadCompanionOperationImageBlob(CONTENT_ID)
		).rejects.toMatchObject({
			statusCode: 404,
		});
		expect(isCompanionOperationContentKnownMissing(CONTENT_ID)).toBe(true);

		clearCompanionOperationContentPreviewDownloadGuard();
		expect(isCompanionOperationContentKnownMissing(CONTENT_ID)).toBe(false);

		vi.mocked(contentApi.downloadContentBlob).mockResolvedValue({
			blob: new Blob(['y'], { type: 'image/png' }),
		});
		await expect(
			downloadCompanionOperationImageBlob(CONTENT_ID)
		).resolves.toBeDefined();
		expect(contentApi.downloadContentBlob).toHaveBeenCalledTimes(2);
	});
});
