/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral lock: useGafAttachmentPreview revokes blob object URLs on close and
 * unmount.
 *
 * Related:
 * - useGafAttachmentPreview.ts
 * - GafChatAttachmentBlock.tsx
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useGafAttachmentPreview } from '@/pages/Desktop/components/GAFChat/components/useGafAttachmentPreview';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

const downloadGafAttachmentBlob = vi.fn();

vi.mock(
	'@/pages/Desktop/components/GAFChat/components/gafAttachmentDownload',
	() => ({
		downloadGafAttachmentBlob: (...args: unknown[]) =>
			downloadGafAttachmentBlob(...args),
	})
);

const defaultArgs = {
	cid: 'content-1',
	kind: 'pdf' as const,
	chatId: 'chat-1',
	messageId: 'msg-1',
	inlineImageBlobUrl: null,
	inlineVideoBlobUrl: null,
};

describe('useGafAttachmentPreview', () => {
	const createObjectURL = vi.fn(() => 'blob:preview-test');
	const revokeObjectURL = vi.fn();

	beforeEach(() => {
		vi.stubGlobal('URL', {
			...URL,
			createObjectURL,
			revokeObjectURL,
		});
		downloadGafAttachmentBlob.mockResolvedValue(
			new Blob(['pdf-bytes'], { type: 'application/pdf' })
		);
		createObjectURL.mockClear();
		revokeObjectURL.mockClear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it('revokes preview object URL when closePreview runs', async () => {
		const { result } = renderHook(() => useGafAttachmentPreview(defaultArgs));

		await act(async () => {
			await result.current.openPreview();
		});

		expect(createObjectURL).toHaveBeenCalledTimes(1);
		expect(revokeObjectURL).not.toHaveBeenCalled();

		act(() => {
			result.current.closePreview();
		});

		expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview-test');
	});

	it('revokes preview object URL on unmount', async () => {
		const { result, unmount } = renderHook(() =>
			useGafAttachmentPreview(defaultArgs)
		);

		await act(async () => {
			await result.current.openPreview();
		});

		expect(createObjectURL).toHaveBeenCalledTimes(1);
		revokeObjectURL.mockClear();

		unmount();

		expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview-test');
	});
});
