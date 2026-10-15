import { describe, expect, it } from 'vitest';
import {
	assistantSpeakerIdentityKey,
	buildMessageListWithDays,
} from '../buildMessageListWithDays';
import type { DesktopAiMessage } from '../api/desktopChatClient';

function m(
	id: string,
	role: 'user' | 'assistant',
	overrides: Partial<DesktopAiMessage> = {}
): DesktopAiMessage {
	return {
		id,
		role,
		content: '',
		created_at: '2026-03-31T12:00:00.000Z',
		...overrides,
	};
}

describe('assistantSpeakerIdentityKey', () => {
	it('differs for different desktop_hero_id', () => {
		const a = m('1', 'assistant', {
			metadata: { desktop_hero_id: 'viktor_engineer' },
		});
		const b = m('2', 'assistant', {
			metadata: { desktop_hero_id: 'arlekino_pravoz' },
		});
		expect(assistantSpeakerIdentityKey(a)).not.toBe(
			assistantSpeakerIdentityKey(b)
		);
	});
});

describe('buildMessageListWithDays', () => {
	const day = (iso: string | null) => (iso ? 'd' : '');

	it('does not compact consecutive assistants with different heroes', () => {
		const messages: DesktopAiMessage[] = [
			m('1', 'user'),
			m('2', 'assistant', {
				metadata: { desktop_hero_id: 'viktor_engineer' },
			}),
			m('3', 'assistant', {
				metadata: { desktop_hero_id: 'arlekino_pravoz' },
			}),
		];
		const entries = buildMessageListWithDays(messages, day);
		const msgEntries = entries.filter((e) => e.kind === 'msg');
		expect(msgEntries[1].compactTop).toBe(false);
		expect(msgEntries[2].compactTop).toBe(false);
	});

	it('compacts consecutive assistants with same hero', () => {
		const messages: DesktopAiMessage[] = [
			m('1', 'user'),
			m('2', 'assistant', {
				metadata: { desktop_hero_id: 'viktor_engineer' },
			}),
			m('3', 'assistant', {
				metadata: { desktop_hero_id: 'viktor_engineer' },
			}),
		];
		const entries = buildMessageListWithDays(messages, day);
		const msgEntries = entries.filter((e) => e.kind === 'msg');
		expect(msgEntries[1].compactTop).toBe(false);
		expect(msgEntries[2].compactTop).toBe(true);
	});

	it('hides empty Discussion anchor stubs from the thread', () => {
		const messages: DesktopAiMessage[] = [
			m('1', 'user', { content: 'hi' }),
			m('2', 'assistant', {
				content: '',
				metadata: {
					desktop_discussion: true,
					discussion_session_id: 'sess-1',
				},
			}),
			m('3', 'assistant', {
				content: 'real reply',
				metadata: { desktop_hero_id: 'viktor_engineer' },
			}),
		];
		const entries = buildMessageListWithDays(messages, day);
		const msgEntries = entries.filter((e) => e.kind === 'msg');
		expect(msgEntries).toHaveLength(2);
		expect(msgEntries[0].msg.id).toBe('1');
		expect(msgEntries[1].msg.id).toBe('3');
	});
});
