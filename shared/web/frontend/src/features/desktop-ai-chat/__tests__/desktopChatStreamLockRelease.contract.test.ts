import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from '../../../services/api/client';
import { releaseDesktopAiChatStreamLock } from '../api/desktopChatClient';

const hoisted = vi.hoisted(() => ({
	delete: vi.fn(),
	post: vi.fn(),
}));

vi.mock('../../../services/api/client', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../../services/api/client')>();
	return {
		...actual,
		apiClient: {
			get: vi.fn(),
			post: hoisted.post,
			patch: vi.fn(),
			delete: hoisted.delete,
		},
	};
});

describe('releaseDesktopAiChatStreamLock', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		hoisted.delete.mockResolvedValue(undefined);
		hoisted.post.mockResolvedValue(undefined);
	});

	it('uses DELETE /stream-lock on success', async () => {
		await releaseDesktopAiChatStreamLock('chat-abc');
		expect(hoisted.delete).toHaveBeenCalledWith(
			'/api/v1/desktop/ai-chat/chats/chat-abc/stream-lock'
		);
		expect(hoisted.post).not.toHaveBeenCalled();
	});

	it('falls back to POST /stream-lock/release on proxy 404', async () => {
		hoisted.delete.mockRejectedValue(
			new APIError(
				'Not Found',
				404,
				undefined,
				undefined,
				undefined,
				'/stream-lock'
			)
		);
		await releaseDesktopAiChatStreamLock('chat-abc');
		expect(hoisted.post).toHaveBeenCalledWith(
			'/api/v1/desktop/ai-chat/chats/chat-abc/stream-lock/release'
		);
	});

	it('rethrows chat-not-found 404 without POST fallback', async () => {
		hoisted.delete.mockRejectedValue(new APIError('Chat not found', 404));
		await expect(
			releaseDesktopAiChatStreamLock('missing')
		).rejects.toMatchObject({
			statusCode: 404,
			message: 'Chat not found',
		});
		expect(hoisted.post).not.toHaveBeenCalled();
	});

	it('rethrows non-404 API errors', async () => {
		hoisted.delete.mockRejectedValue(new APIError('Forbidden', 403));
		await expect(
			releaseDesktopAiChatStreamLock('chat-abc')
		).rejects.toMatchObject({
			statusCode: 403,
		});
		expect(hoisted.post).not.toHaveBeenCalled();
	});
});
