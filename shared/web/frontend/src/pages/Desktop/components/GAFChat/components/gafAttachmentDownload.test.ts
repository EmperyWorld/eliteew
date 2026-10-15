/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Verify attachment blob source selection for GAF chat previews.
 *
 * Invariants:
 * - Persisted messages prefer chat-scoped attachment endpoint.
 * - Optimistic/non-chat contexts fall back to unified content endpoint.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/components/gafAttachmentDownload.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const downloadContentBlobMock = vi.fn();
const downloadGafMessageAttachmentBlobMock = vi.fn();

vi.mock('@/services/contentApi', () => ({
	contentApi: {
		downloadContentBlob: (...args: unknown[]) =>
			downloadContentBlobMock(...args),
	},
}));

vi.mock('../api/gafChatApi', () => ({
	downloadGafMessageAttachmentBlob: (...args: unknown[]) =>
		downloadGafMessageAttachmentBlobMock(...args),
}));

import { downloadGafAttachmentBlob } from './gafAttachmentDownload';

describe('downloadGafAttachmentBlob', () => {
	beforeEach(() => {
		downloadContentBlobMock.mockReset();
		downloadGafMessageAttachmentBlobMock.mockReset();
	});

	it('uses chat attachment endpoint for persisted messages', async () => {
		const blob = new Blob(['chat']);
		downloadGafMessageAttachmentBlobMock.mockResolvedValueOnce(blob);

		const out = await downloadGafAttachmentBlob({
			contentId: 'content-1',
			chatId: 'chat-1',
			messageId: 'msg-1',
		});

		expect(out).toBe(blob);
		expect(downloadGafMessageAttachmentBlobMock).toHaveBeenCalledWith(
			'chat-1',
			'msg-1'
		);
		expect(downloadContentBlobMock).not.toHaveBeenCalled();
	});

	it('falls back to content endpoint for optimistic message ids', async () => {
		const blob = new Blob(['content']);
		downloadContentBlobMock.mockResolvedValueOnce({ blob });

		const out = await downloadGafAttachmentBlob({
			contentId: 'content-2',
			chatId: 'chat-2',
			messageId: 'gaf-opt-123',
		});

		expect(out).toBe(blob);
		expect(downloadContentBlobMock).toHaveBeenCalledWith('content-2');
		expect(downloadGafMessageAttachmentBlobMock).not.toHaveBeenCalled();
	});

	it('falls back to content endpoint without chat context', async () => {
		const blob = new Blob(['fallback']);
		downloadContentBlobMock.mockResolvedValueOnce({ blob });

		const out = await downloadGafAttachmentBlob({
			contentId: 'content-3',
		});

		expect(out).toBe(blob);
		expect(downloadContentBlobMock).toHaveBeenCalledWith('content-3');
		expect(downloadGafMessageAttachmentBlobMock).not.toHaveBeenCalled();
	});
});
