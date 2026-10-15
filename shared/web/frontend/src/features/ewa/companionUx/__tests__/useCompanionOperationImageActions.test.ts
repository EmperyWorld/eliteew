/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for useCompanionOperationImageActions (U8.3 slice 11).
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useCompanionOperationImageActions } from '@/features/ewa/companionUx/useCompanionOperationImageActions';

const downloadContent = vi.fn();
const requestOpenDesktopApp = vi.fn();

vi.mock('@/services/contentApi', () => ({
	contentApi: {
		downloadContent: (...args: unknown[]) => downloadContent(...args),
		getContent: vi.fn(),
		downloadContentBlob: vi.fn(),
	},
}));

vi.mock('@/pages/Desktop/utils/desktopDeepLink', () => ({
	requestOpenDesktopApp: (...args: unknown[]) => requestOpenDesktopApp(...args),
}));

const baseImageReady = {
	unifiedContentId: 'uc-1',
	promptPreview: 'preview',
	previewUrl: 'https://example.com/img.png',
	downloadFilename: 'img.png',
	mimeType: 'image/png',
	mode: 'generate' as const,
	sourceUnifiedContentId: null,
};

describe('useCompanionOperationImageActions', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('downloads image by unified content id', async () => {
		const { result } = renderHook(() =>
			useCompanionOperationImageActions({
				ru: false,
				notifyError: vi.fn(),
				t: ((key: string) => key) as never,
				updateDraft: vi.fn(),
				inputRef: { current: null },
				setPendingImage: vi.fn(),
			})
		);
		await act(async () => {
			await result.current.handleDownloadGeneratedImage({
				...baseImageReady,
				unifiedContentId: 'uc-1',
			});
		});
		expect(downloadContent).toHaveBeenCalledWith('uc-1', 'img.png');
	});

	it('opens GAF with attachment when sharing', () => {
		const { result } = renderHook(() =>
			useCompanionOperationImageActions({
				ru: false,
				notifyError: vi.fn(),
				t: ((key: string) => key) as never,
				updateDraft: vi.fn(),
				inputRef: { current: null },
				setPendingImage: vi.fn(),
			})
		);
		act(() => {
			result.current.handleShareGeneratedImageToGaf({
				...baseImageReady,
				unifiedContentId: 'uc-2',
			});
		});
		expect(requestOpenDesktopApp).toHaveBeenCalledWith(
			expect.objectContaining({
				appComponent: 'GAFChatApp',
				gafComposerAttachmentContentId: 'uc-2',
			})
		);
	});
});
