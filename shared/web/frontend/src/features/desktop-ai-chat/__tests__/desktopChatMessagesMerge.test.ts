import { describe, expect, it } from 'vitest';
import {
	countPersistedDesktopAiMessages,
	DESKTOP_AI_MESSAGES_OLDER_PAGE,
	DESKTOP_AI_MESSAGES_TAIL,
	mergeServerTailWithOlderPrefix,
	nextOlderMessagesQuery,
	prependOlderSlice,
} from '../desktopChatMessagesMerge';
import type { DesktopAiMessage } from '../api/desktopChatClient';
import type { ListDesktopAiMessagesResult } from '../api/desktopChatClient';

describe('desktop AI message window constants', () => {
	it('keeps a short initial tail and matching older page size', () => {
		expect(DESKTOP_AI_MESSAGES_TAIL).toBe(6);
		expect(DESKTOP_AI_MESSAGES_OLDER_PAGE).toBe(6);
	});
});

describe('nextOlderMessagesQuery', () => {
	it('pages backward from the loaded contiguous suffix', () => {
		expect(nextOlderMessagesQuery(100, 6, 6)).toEqual({
			offset: 88,
			limit: 6,
		});
		expect(nextOlderMessagesQuery(100, 12, 6)).toEqual({
			offset: 82,
			limit: 6,
		});
	});

	it('uses a smaller final page when fewer older messages remain', () => {
		expect(nextOlderMessagesQuery(10, 8, 6)).toEqual({
			offset: 0,
			limit: 2,
		});
	});

	it('returns null when the full history is already loaded', () => {
		expect(nextOlderMessagesQuery(6, 6, 6)).toBeNull();
		expect(nextOlderMessagesQuery(0, 0, 6)).toBeNull();
	});
});

describe('countPersistedDesktopAiMessages', () => {
	it('ignores local placeholders', () => {
		expect(
			countPersistedDesktopAiMessages([
				msg('local-a', 'user', 'x', '2020-01-01T00:00:00.000Z'),
				msg('1', 'assistant', 'y', '2020-01-01T00:01:00.000Z'),
			])
		).toBe(1);
	});
});

function msg(
	id: string,
	role: string,
	content: string,
	created_at: string
): DesktopAiMessage {
	return { id, role, content, created_at };
}

describe('mergeServerTailWithOlderPrefix', () => {
	it('keeps older prefix and replaces tail from server', () => {
		const prev: DesktopAiMessage[] = [
			msg('1', 'user', 'a', '2020-01-01T00:00:00.000Z'),
			msg('2', 'assistant', 'b', '2020-01-01T00:01:00.000Z'),
		];
		const result: ListDesktopAiMessagesResult = {
			items: [
				msg('2', 'assistant', 'b-fixed', '2020-01-01T00:01:00.000Z'),
				msg('3', 'user', 'c', '2020-01-02T00:00:00.000Z'),
			],
			total: 3,
			truncated: true,
		};
		const out = mergeServerTailWithOlderPrefix(prev, result);
		expect(out.map((m) => m.id)).toEqual(['1', '2', '3']);
		expect(out.find((m) => m.id === '2')?.content).toBe('b-fixed');
	});

	it('drops local- placeholders', () => {
		const prev: DesktopAiMessage[] = [
			msg('local-x', 'user', 'x', '2020-01-03T00:00:00.000Z'),
			msg('10', 'assistant', 'y', '2020-01-03T00:01:00.000Z'),
		];
		const result: ListDesktopAiMessagesResult = {
			items: [msg('10', 'assistant', 'y2', '2020-01-03T00:01:00.000Z')],
			total: 1,
		};
		const out = mergeServerTailWithOlderPrefix(prev, result);
		expect(out.some((m) => m.id.startsWith('local-'))).toBe(false);
	});
});

describe('prependOlderSlice', () => {
	it('merges by id and sorts by time', () => {
		const current = [msg('3', 'user', 'c', '2020-01-02T00:00:00.000Z')];
		const older = [
			msg('1', 'user', 'a', '2020-01-01T00:00:00.000Z'),
			msg('2', 'assistant', 'b', '2020-01-01T00:01:00.000Z'),
		];
		const out = prependOlderSlice(current, older);
		expect(out.map((m) => m.id)).toEqual(['1', '2', '3']);
	});
});
