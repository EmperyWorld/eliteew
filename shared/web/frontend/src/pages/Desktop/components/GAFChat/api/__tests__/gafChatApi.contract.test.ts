import { describe, expect, it } from 'vitest';
import type { components } from '@/generated/gaf-chat-openapi';
import { GAF_CHAT_API_V1_BASE } from '../gafChatApi';

describe('gaf-chat API path contract', () => {
	it('uses v1 mount from shared/api/domains/social.py', () => {
		expect(GAF_CHAT_API_V1_BASE).toBe('/api/v1/gaf-chat');
	});

	it('resolves me and chats paths', () => {
		expect(`${GAF_CHAT_API_V1_BASE}/me`).toBe('/api/v1/gaf-chat/me');
		expect(`${GAF_CHAT_API_V1_BASE}/chats`).toBe('/api/v1/gaf-chat/chats');
	});

	it('me response matches pilot OpenAPI schema', () => {
		const me: components['schemas']['GafChatMeResponse'] = {
			user_id: 'db-user-uuid',
		};
		expect(me.user_id).toBe('db-user-uuid');
	});

	it('chat list row matches ChatListItem schema', () => {
		const row: components['schemas']['ChatListItem'] = {
			chat_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
			partner: {
				id: 'p1',
				username: 'x',
				avatar_url: null,
				full_name: null,
				bio: null,
				is_trusted: false,
				admin_badge_label: null,
				admin_badge_hint: null,
				is_system_account: false,
				is_muted: false,
				is_blocked: false,
				blocked_by_partner: false,
			},
			last_message_at: null,
			last_message_preview: null,
			unread_count: 0,
			e2ee_status: 'off',
			e2ee_ready: false,
			partner_last_read_message_id: null,
		};
		expect(row.chat_id).toContain('aaaa');
	});
});
