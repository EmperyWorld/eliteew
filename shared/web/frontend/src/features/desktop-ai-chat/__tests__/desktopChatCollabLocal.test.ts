import { describe, expect, it } from 'vitest';
import type { DesktopAiChatItem } from '../api/desktopChatClient';
import { removeChatFromLocalList } from '../utils/desktopChatCollabLocal';

const row = (id: string): DesktopAiChatItem => ({
	id,
	user_id: 'u',
	company_id: null,
	project_id: null,
	title: id,
	llama_model: null,
	system_prompt_override: null,
	use_project_rag: false,
	vault_rag_eligible: false,
	settings: {},
	created_at: null,
	updated_at: null,
});

describe('removeChatFromLocalList', () => {
	it('removes only the matching chat id (guest leave personal disappearance)', () => {
		const chats = [row('a'), row('b'), row('c')];
		const next = removeChatFromLocalList(chats, 'b');
		expect(next.map((c) => c.id)).toEqual(['a', 'c']);
	});

	it('returns same-length list when id missing', () => {
		const chats = [row('a')];
		expect(removeChatFromLocalList(chats, 'missing')).toEqual(chats);
	});
});
