import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	acceptDesktopAiChatInvite,
	declineDesktopAiChatInvite,
	getDesktopAiChatMe,
	inviteDesktopAiChatMember,
	leaveDesktopAiChat,
	listDesktopAiChatMembers,
	listDesktopAiChatPendingInvites,
	peekDesktopAiChatStreamLock,
	removeDesktopAiChatMember,
} from '../api/desktopChatClient';

const hoisted = vi.hoisted(() => ({
	get: vi.fn(),
	post: vi.fn(),
	delete: vi.fn(),
}));

vi.mock('../../../services/api/client', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../../services/api/client')>();
	return {
		...actual,
		apiClient: {
			get: hoisted.get,
			post: hoisted.post,
			delete: hoisted.delete,
			patch: vi.fn(),
		},
	};
});

describe('desktop chat collaboration API client', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('listMembers uses owner roster path', async () => {
		hoisted.get.mockResolvedValue({ data: { items: [{ id: 'm1' }] } });
		const items = await listDesktopAiChatMembers('chat-1');
		expect(hoisted.get).toHaveBeenCalledWith(
			'/api/v1/desktop/ai-chat/chats/chat-1/members'
		);
		expect(items).toEqual([{ id: 'm1' }]);
	});

	it('inviteMember posts friend_user_id', async () => {
		hoisted.post.mockResolvedValue({ data: { id: 'm2', status: 'pending' } });
		await inviteDesktopAiChatMember('chat-1', 'friend-9');
		expect(hoisted.post).toHaveBeenCalledWith(
			'/api/v1/desktop/ai-chat/chats/chat-1/members/invite',
			{ friend_user_id: 'friend-9' }
		);
	});

	it('removeMember posts remove path', async () => {
		hoisted.post.mockResolvedValue({ data: { id: 'm3' } });
		await removeDesktopAiChatMember('chat-1', 'user-9');
		expect(hoisted.post).toHaveBeenCalledWith(
			'/api/v1/desktop/ai-chat/chats/chat-1/members/user-9/remove'
		);
	});

	it('leaveChat posts leave without body', async () => {
		hoisted.post.mockResolvedValue({});
		await leaveDesktopAiChat('chat-1');
		expect(hoisted.post).toHaveBeenCalledWith(
			'/api/v1/desktop/ai-chat/chats/chat-1/leave'
		);
	});

	it('pending invites and accept/decline paths', async () => {
		hoisted.get.mockResolvedValue({ data: { items: [] } });
		await listDesktopAiChatPendingInvites();
		expect(hoisted.get).toHaveBeenCalledWith(
			'/api/v1/desktop/ai-chat/invites/pending'
		);

		hoisted.post.mockResolvedValue({ data: { id: 'm4' } });
		await acceptDesktopAiChatInvite('m4');
		expect(hoisted.post).toHaveBeenCalledWith(
			'/api/v1/desktop/ai-chat/invites/m4/accept'
		);

		await declineDesktopAiChatInvite('m4');
		expect(hoisted.post).toHaveBeenCalledWith(
			'/api/v1/desktop/ai-chat/invites/m4/decline'
		);
	});

	it('peekStreamLock normalizes locked flag', async () => {
		hoisted.get.mockResolvedValue({
			data: { locked: true, holder_user_id: 'u1', ttl_sec: 12 },
		});
		const peek = await peekDesktopAiChatStreamLock('chat-1');
		expect(hoisted.get).toHaveBeenCalledWith(
			'/api/v1/desktop/ai-chat/chats/chat-1/stream-lock'
		);
		expect(peek).toEqual({
			locked: true,
			holder_user_id: 'u1',
			ttl_sec: 12,
		});
	});

	it('getDesktopAiChatMe hits /me for DB user_id', async () => {
		hoisted.get.mockResolvedValue({ data: { user_id: 'db-user-1' } });
		const me = await getDesktopAiChatMe();
		expect(hoisted.get).toHaveBeenCalledWith('/api/v1/desktop/ai-chat/me');
		expect(me).toEqual({ user_id: 'db-user-1' });
	});
});
