/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral lock for Socket.IO message_new merge into the Desktop AI Chat tail.
 */
import { describe, expect, it } from 'vitest';
import type { DesktopAiMessage } from '../api/desktopChatClient';
import { mergeDesktopAiChatSocketMessage } from '../utils/desktopAiChatSocketMessageMerge';

function msg(
	partial: Partial<DesktopAiMessage> &
		Pick<DesktopAiMessage, 'id' | 'role' | 'content'>
): DesktopAiMessage {
	return {
		created_at: null,
		author_user_id: null,
		...partial,
	} as DesktopAiMessage;
}

describe('mergeDesktopAiChatSocketMessage', () => {
	it('appends a new peer user message', () => {
		const prev = [msg({ id: 'a', role: 'user', content: 'hi' })];
		const next = mergeDesktopAiChatSocketMessage(
			prev,
			msg({
				id: 'b',
				role: 'user',
				content: 'peer',
				author_user_id: 'u2',
			})
		);
		expect(next.map((m) => m.id)).toEqual(['a', 'b']);
	});

	it('dedupes by stable id', () => {
		const row = msg({ id: 'same', role: 'user', content: 'x' });
		expect(mergeDesktopAiChatSocketMessage([row], row)).toEqual([row]);
	});

	it('replaces local-* optimistic user row for the same author', () => {
		const prev = [
			msg({
				id: 'local-1',
				role: 'user',
				content: 'draft',
				author_user_id: 'u1',
			}),
		];
		const next = mergeDesktopAiChatSocketMessage(
			prev,
			msg({
				id: 'persisted',
				role: 'user',
				content: 'draft',
				author_user_id: 'u1',
			})
		);
		expect(next).toHaveLength(1);
		expect(next[0]?.id).toBe('persisted');
	});

	it('keeps other authors local rows when replacing self optimistic', () => {
		const prev = [
			msg({
				id: 'local-peer',
				role: 'user',
				content: 'other',
				author_user_id: 'u2',
			}),
			msg({
				id: 'local-self',
				role: 'user',
				content: 'me',
				author_user_id: 'u1',
			}),
		];
		const next = mergeDesktopAiChatSocketMessage(
			prev,
			msg({
				id: 'persisted',
				role: 'user',
				content: 'me',
				author_user_id: 'u1',
			})
		);
		expect(next.map((m) => m.id)).toEqual(['local-peer', 'persisted']);
	});
});
