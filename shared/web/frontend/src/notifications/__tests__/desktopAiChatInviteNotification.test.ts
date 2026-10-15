/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract locks for Desktop AI Chat invite notification open-app + accept/decline actions.
 *
 * Invariants:
 * - openApp maps chat_id → DesktopAiChatApp + desktopAiChatId.
 * - Accept posts invites API and opens the chat; decline dismisses only.
 *
 * Related:
 * - ../openAppFromMetadata.ts
 * - ../executeServerNotificationAction.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openAppDetailFromNotification } from '../openAppFromMetadata';

const post = vi.fn();
const dismiss = vi.fn();
const requestOpenDesktopApp = vi.fn();

vi.mock('@/services/api', () => ({
	apiClient: { post: (...args: unknown[]) => post(...args) },
}));

vi.mock('@/pages/Desktop/utils/desktopDeepLink', () => ({
	requestOpenDesktopApp: (...args: unknown[]) => requestOpenDesktopApp(...args),
}));

vi.mock('../context', () => ({
	getNotificationStoreRef: () => ({ current: { dismiss } }),
}));

vi.mock('../api', () => ({
	notify: { error: vi.fn() },
}));

describe('openAppDetailFromNotification desktop AI chat invite', () => {
	it('maps kind + chat_id to DesktopAiChatApp payload', () => {
		expect(
			openAppDetailFromNotification('desktop_ai_chat', {
				kind: 'desktop_ai_chat_invite',
				chat_id: '  chat-7  ',
			})
		).toEqual({
			appComponent: 'DesktopAiChatApp',
			desktopAiChatId: 'chat-7',
		});
	});
});

describe('executeServerNotificationAction desktop AI chat invite', () => {
	beforeEach(() => {
		post.mockReset();
		dismiss.mockReset();
		requestOpenDesktopApp.mockReset();
		post.mockResolvedValue({});
	});

	it('accept posts, dismisses, and opens chat', async () => {
		const { executeServerNotificationAction } = await import(
			'../executeServerNotificationAction'
		);
		await executeServerNotificationAction(
			{
				id: 'desktop_ai_chat_invite_m1',
				type: 'info',
				title: 'Invite',
				message: 'Join',
				timestamp: new Date(),
				read: false,
				metadata: {
					kind: 'desktop_ai_chat_invite',
					member_id: 'm1',
					chat_id: 'chat-1',
				},
			},
			'desktop_ai_chat_invite_accept'
		);
		expect(post).toHaveBeenCalledWith(
			'/api/v1/desktop/ai-chat/invites/m1/accept'
		);
		expect(dismiss).toHaveBeenCalledWith('desktop_ai_chat_invite_m1');
		expect(requestOpenDesktopApp).toHaveBeenCalledWith({
			appComponent: 'DesktopAiChatApp',
			desktopAiChatId: 'chat-1',
		});
	});

	it('decline posts and dismisses without open', async () => {
		const { executeServerNotificationAction } = await import(
			'../executeServerNotificationAction'
		);
		await executeServerNotificationAction(
			{
				id: 'desktop_ai_chat_invite_m2',
				type: 'info',
				title: 'Invite',
				message: 'Join',
				timestamp: new Date(),
				read: false,
				metadata: {
					kind: 'desktop_ai_chat_invite',
					member_id: 'm2',
					chat_id: 'chat-2',
				},
			},
			'desktop_ai_chat_invite_decline'
		);
		expect(post).toHaveBeenCalledWith(
			'/api/v1/desktop/ai-chat/invites/m2/decline'
		);
		expect(dismiss).toHaveBeenCalledWith('desktop_ai_chat_invite_m2');
		expect(requestOpenDesktopApp).not.toHaveBeenCalled();
	});
});
