import { describe, expect, it } from 'vitest';
import {
	DESKTOP_AI_CHAT_SOCKET,
	isDesktopAiChatMemberChangedPayload,
	isDesktopAiChatMessageNewPayload,
	isDesktopAiChatTurnEventPayload,
} from '../types/desktopAiChatRealtimeTypes';

describe('desktop ai chat realtime socket contract', () => {
	it('join payload uses chat_id key', () => {
		const payload = { chat_id: '00000000-0000-0000-0000-000000000001' };
		expect(payload).toEqual({
			chat_id: '00000000-0000-0000-0000-000000000001',
		});
		expect(DESKTOP_AI_CHAT_SOCKET.JOIN).toBe('desktop_ai_chat_join');
		expect(DESKTOP_AI_CHAT_SOCKET.LEAVE).toBe('desktop_ai_chat_leave');
	});

	it('turn event names match backend emit module', () => {
		expect(DESKTOP_AI_CHAT_SOCKET.TURN_STARTED).toBe(
			'desktop_ai_chat.turn_started'
		);
		expect(DESKTOP_AI_CHAT_SOCKET.TURN_DONE).toBe('desktop_ai_chat.turn_done');
		expect(DESKTOP_AI_CHAT_SOCKET.MESSAGE_NEW).toBe(
			'desktop_ai_chat.message_new'
		);
		expect(DESKTOP_AI_CHAT_SOCKET.MEMBER_CHANGED).toBe(
			'desktop_ai_chat.member_changed'
		);
		expect(DESKTOP_AI_CHAT_SOCKET.JOINED).toBe('desktop_ai_chat.joined');
	});

	it('type guards accept minimal turn, member, and message payloads', () => {
		expect(
			isDesktopAiChatTurnEventPayload({
				chat_id: 'c1',
				actor_user_id: 'u1',
			})
		).toBe(true);
		expect(isDesktopAiChatTurnEventPayload({ chat_id: 'c1' })).toBe(false);

		expect(
			isDesktopAiChatMemberChangedPayload({
				chat_id: 'c1',
				reason: 'invite',
				actor_user_id: 'u1',
				target_user_id: 'u2',
			})
		).toBe(true);
		expect(
			isDesktopAiChatMemberChangedPayload({
				chat_id: 'c1',
				reason: 'leave',
				actor_user_id: 'u1',
			})
		).toBe(true);

		expect(
			isDesktopAiChatMessageNewPayload({
				chat_id: 'c1',
				message: { id: 'm1', role: 'user', content: 'hi' },
			})
		).toBe(true);
		expect(
			isDesktopAiChatMessageNewPayload({
				chat_id: 'c1',
				message: { role: 'user', content: 'hi' },
			})
		).toBe(false);
	});
});
