/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for Assistant display message merge and visible window split.
 *
 * Invariants:
 * - Older messages slice preserves order; recent window matches tail length.
 *
 * Related:
 * - pages/Desktop/components/assistant/splitAssistantDisplayMessages.ts
 */
import { describe, expect, it } from 'vitest';
import type { AssistantChatMessage } from '../../../services/productDesktopApi';
import {
	findLastPersistedAssistantId,
	findUserQuestionBeforeAssistant,
	mergeAssistantDisplayMessages,
	splitAssistantVisibleMessages,
} from '../splitAssistantDisplayMessages';

function msg(
	id: string,
	role: AssistantChatMessage['role'],
	content: string,
	created_at: string
): AssistantChatMessage {
	return { id, role, content, created_at };
}

describe('splitAssistantDisplayMessages', () => {
	it('returns server messages when local FAQ list is empty', () => {
		const server = [msg('1', 'user', 'hi', '2026-01-01T00:00:00.000Z')];
		expect(mergeAssistantDisplayMessages(server, [])).toEqual(server);
	});

	it('merges and sorts local FAQ messages by created_at', () => {
		const server = [msg('s1', 'user', 'old', '2026-01-01T00:00:00.000Z')];
		const local = [msg('l1', 'assistant', 'faq', '2026-01-02T00:00:00.000Z')];
		const merged = mergeAssistantDisplayMessages(server, local);
		expect(merged.map((m) => m.id)).toEqual(['s1', 'l1']);
	});

	it('interleaves local and server messages chronologically', () => {
		const server = [
			msg('s1', 'user', 'early server', '2026-01-01T10:00:00.000Z'),
			msg('s2', 'assistant', 'late server', '2026-01-01T14:00:00.000Z'),
		];
		const local = [
			msg('faq-local-u-1', 'user', 'mid local q', '2026-01-01T12:00:00.000Z'),
			msg(
				'faq-local-a-1',
				'assistant',
				'mid local a',
				'2026-01-01T12:00:01.000Z'
			),
		];
		const merged = mergeAssistantDisplayMessages(server, local);
		expect(merged.map((m) => m.id)).toEqual([
			's1',
			'faq-local-u-1',
			'faq-local-a-1',
			's2',
		]);
	});

	it('splits older and recent windows at visible count', () => {
		const display = Array.from({ length: 12 }, (_, i) =>
			msg(`m${i}`, 'user', `q${i}`, `2026-01-01T00:0${i}:00.000Z`)
		);
		const { olderMessages, recentMessages, allVisibleMessages } =
			splitAssistantVisibleMessages(display, 10);
		expect(olderMessages).toHaveLength(2);
		expect(recentMessages).toHaveLength(10);
		expect(allVisibleMessages).toHaveLength(12);
		expect(recentMessages[0]?.id).toBe('m2');
	});

	it('finds last persisted assistant id from server list', () => {
		const messages = [
			msg('u1', 'user', 'q', '2026-01-01T00:00:00.000Z'),
			msg('a1', 'assistant', 'a', '2026-01-01T00:01:00.000Z'),
			msg('u2', 'user', 'q2', '2026-01-01T00:02:00.000Z'),
		];
		expect(findLastPersistedAssistantId(messages)).toBe('a1');
	});

	it('finds user question before assistant bubble index', () => {
		const pool = [
			msg('u1', 'user', 'first', '2026-01-01T00:00:00.000Z'),
			msg('a1', 'assistant', 'ans', '2026-01-01T00:01:00.000Z'),
		];
		expect(findUserQuestionBeforeAssistant(1, pool)).toBe('first');
		expect(findUserQuestionBeforeAssistant(0, pool)).toBe('');
	});
});
