import { describe, expect, it } from 'vitest';
import type { DesktopAiChatItem } from '../api/desktopChatClient';
import {
	DESKTOP_CHAT_CAPABILITY_KEYS,
	hasDesktopChatCapability,
	isDesktopChatOwner,
	resolveDesktopChatCapabilities,
} from '../utils/desktopChatCapabilities';

const baseChat = (): DesktopAiChatItem => ({
	id: 'chat-1',
	user_id: 'owner-1',
	company_id: null,
	project_id: null,
	title: 'Team',
	llama_model: null,
	system_prompt_override: null,
	use_project_rag: false,
	vault_rag_eligible: false,
	settings: {},
	created_at: null,
	updated_at: null,
});

describe('resolveDesktopChatCapabilities', () => {
	it('denies all keys when chat is null', () => {
		const caps = resolveDesktopChatCapabilities(null);
		for (const key of DESKTOP_CHAT_CAPABILITY_KEYS) {
			expect(caps[key]).toBe(false);
		}
	});

	it('denies all keys for guest with empty capabilities map', () => {
		const chat: DesktopAiChatItem = {
			...baseChat(),
			viewer_role: 'guest',
			capabilities: {},
		};
		const caps = resolveDesktopChatCapabilities(chat);
		expect(caps.can_stream).toBe(false);
		expect(caps.can_leave).toBe(false);
		expect(caps.can_regenerate).toBe(false);
	});

	it('honours explicit owner capabilities from API', () => {
		const chat: DesktopAiChatItem = {
			...baseChat(),
			viewer_role: 'owner',
			capabilities: {
				can_stream: true,
				can_manage_members: true,
				can_leave: false,
				can_delete_chat: true,
			},
		};
		const caps = resolveDesktopChatCapabilities(chat);
		expect(caps.can_manage_members).toBe(true);
		expect(caps.can_leave).toBe(false);
		expect(caps.can_regenerate).toBe(false);
	});

	it('legacy owner chat without collab fields keeps owner powers', () => {
		const caps = resolveDesktopChatCapabilities(baseChat());
		expect(caps.can_delete_chat).toBe(true);
		expect(caps.can_manage_members).toBe(true);
		expect(caps.can_leave).toBe(false);
	});
});

describe('isDesktopChatOwner', () => {
	it('returns true for viewer_role owner', () => {
		expect(isDesktopChatOwner({ ...baseChat(), viewer_role: 'owner' })).toBe(
			true
		);
	});

	it('returns false for guest', () => {
		expect(isDesktopChatOwner({ ...baseChat(), viewer_role: 'guest' })).toBe(
			false
		);
	});
});

describe('hasDesktopChatCapability', () => {
	it('reads resolved capability by key', () => {
		const chat: DesktopAiChatItem = {
			...baseChat(),
			viewer_role: 'guest',
			capabilities: { can_leave: true, can_stream: true },
		};
		expect(hasDesktopChatCapability(chat, 'can_leave')).toBe(true);
		expect(hasDesktopChatCapability(chat, 'can_delete_chat')).toBe(false);
	});
});
