import { describe, expect, it } from 'vitest';
import {
	appendGafSocketMessageToInfinitePages,
	dedupeMessagesById,
	GAF_OPTIMISTIC_ID_PREFIX,
	gafSocketPayloadToMessageItem,
	getLegacyPostCallSummaryLabel,
	isGafOptimisticMessageId,
	isLegacyPostCallSummaryBody,
	mergeGafInfinitePages,
	resolveGafChatSendMode,
	resolveGafLastMessageIdForRead,
	sortMessagesAsc,
} from '../gafChatMessageUtils';
import type { GAFMessageItem } from '../types';

function msg(
	id: string,
	createdAt: string,
	overrides: Partial<GAFMessageItem> = {}
): GAFMessageItem {
	return {
		id,
		chat_id: 'c1',
		sender_id: 'u1',
		body: 'x',
		created_at: createdAt,
		edited_at: null,
		deleted_for_sender: false,
		deleted_for_recipient: false,
		algorithm: 'plain',
		encryption_version: null,
		body_ciphertext: null,
		nonce: null,
		...overrides,
	};
}

describe('sortMessagesAsc', () => {
	it('orders by created_at', () => {
		const a = msg('1', '2026-01-02T10:00:00.000Z');
		const b = msg('2', '2026-01-01T10:00:00.000Z');
		expect(sortMessagesAsc([a, b]).map((m) => m.id)).toEqual(['2', '1']);
	});
});

describe('dedupeMessagesById', () => {
	it('keeps first occurrence', () => {
		const a = msg('1', '2026-01-01T10:00:00.000Z');
		const b = msg('1', '2026-01-02T10:00:00.000Z');
		expect(dedupeMessagesById([a, b])).toEqual([a]);
	});
});

describe('isGafOptimisticMessageId', () => {
	it('detects gaf-opt prefix', () => {
		expect(isGafOptimisticMessageId(`${GAF_OPTIMISTIC_ID_PREFIX}abc`)).toBe(
			true
		);
		expect(
			isGafOptimisticMessageId('35680e08-6a9a-4d70-90b1-90d5fb5d3476')
		).toBe(false);
	});
});

describe('resolveGafLastMessageIdForRead', () => {
	it('skips trailing optimistic message', () => {
		const real = msg('real-1', '2026-01-02T10:00:00.000Z');
		const opt = msg(`${GAF_OPTIMISTIC_ID_PREFIX}x`, '2026-01-02T11:00:00.000Z');
		expect(resolveGafLastMessageIdForRead([real, opt], 'c1')).toBe('real-1');
	});

	it('returns undefined when only optimistic messages exist', () => {
		const opt = msg(`${GAF_OPTIMISTIC_ID_PREFIX}x`, '2026-01-02T11:00:00.000Z');
		expect(resolveGafLastMessageIdForRead([opt], 'c1')).toBeUndefined();
	});
});

describe('mergeGafInfinitePages', () => {
	it('merges newest window then older pages into ascending timeline', () => {
		const page0 = [
			msg('n1', '2026-01-02T12:00:00.000Z'),
			msg('n2', '2026-01-02T13:00:00.000Z'),
		];
		const page1 = [
			msg('o1', '2026-01-02T10:00:00.000Z'),
			msg('o2', '2026-01-02T11:00:00.000Z'),
		];
		const merged = mergeGafInfinitePages([page0, page1]);
		expect(merged.map((m) => m.id)).toEqual(['o1', 'o2', 'n1', 'n2']);
	});

	it('dedupes overlapping ids across pages', () => {
		const dup = msg('x', '2026-01-02T11:30:00.000Z');
		const merged = mergeGafInfinitePages([
			[dup, msg('n', '2026-01-02T13:00:00.000Z')],
			[
				msg('x', '2026-01-02T11:30:00.000Z'),
				msg('o', '2026-01-02T10:00:00.000Z'),
			],
		]);
		expect(merged.filter((m) => m.id === 'x')).toHaveLength(1);
	});
});

describe('resolveGafChatSendMode', () => {
	it('keeps ordinary chat as the default send path', () => {
		expect(
			resolveGafChatSendMode({
				e2eeActive: false,
				hasAttachment: false,
				replyToMessageId: null,
			})
		).toEqual({ kind: 'plain' });
	});

	it('uses E2EE when active and blocks reply quotes only', () => {
		expect(
			resolveGafChatSendMode({
				e2eeActive: true,
				hasAttachment: false,
				replyToMessageId: null,
			})
		).toEqual({ kind: 'e2ee' });
		expect(
			resolveGafChatSendMode({
				e2eeActive: true,
				hasAttachment: true,
				replyToMessageId: null,
			})
		).toEqual({ kind: 'e2ee' });
		expect(
			resolveGafChatSendMode({
				e2eeActive: true,
				hasAttachment: false,
				replyToMessageId: 'message-1',
			})
		).toEqual({ kind: 'blocked', reason: 'reply' });
	});
});

describe('legacy post-call summary bodies', () => {
	it('detects mobile duplicate summary text via duration suffix', () => {
		const body = '📞 Call with partner · ~1 min';
		expect(isLegacyPostCallSummaryBody(body)).toBe(true);
		expect(getLegacyPostCallSummaryLabel(body)).toBe(body);
	});

	it('detects metadata system_message_kind', () => {
		expect(
			isLegacyPostCallSummaryBody('anything', {
				system_message_kind: 'legacy_post_call_summary',
			})
		).toBe(true);
	});

	it('ignores regular chat text', () => {
		expect(isLegacyPostCallSummaryBody('Привет')).toBe(false);
	});
});

describe('gafSocketPayloadToMessageItem', () => {
	it('maps socket payload with E2EE fields', () => {
		const item = gafSocketPayloadToMessageItem({
			chat_id: 'chat-1',
			message_id: 'msg-1',
			sender_id: 'user-2',
			body: '',
			created_at: '2026-06-19T12:00:00.000Z',
			algorithm: 'e2e_v1',
			body_ciphertext: 'cipher',
			nonce: 'nonce',
		});
		expect(item?.id).toBe('msg-1');
		expect(item?.algorithm).toBe('e2e_v1');
		expect(item?.body_ciphertext).toBe('cipher');
	});
});

describe('appendGafSocketMessageToInfinitePages', () => {
	it('appends to first page without duplicates', () => {
		const existing = msg('1', '2026-06-19T11:00:00.000Z');
		const incoming = msg('2', '2026-06-19T12:00:00.000Z');
		const pages = appendGafSocketMessageToInfinitePages([[existing]], incoming);
		expect(pages[0]?.map((m) => m.id)).toEqual(['1', '2']);
		const again = appendGafSocketMessageToInfinitePages(pages, incoming);
		expect(again).toBe(pages);
	});

	it('replaces optimistic outbound row on sender echo', () => {
		const opt = msg(
			`${GAF_OPTIMISTIC_ID_PREFIX}x`,
			'2026-06-19T11:00:00.000Z',
			{
				body: 'hi',
				sender_id: 'me',
			}
		);
		const incoming = msg('server-1', '2026-06-19T11:00:01.000Z', {
			body: 'hi',
			sender_id: 'me',
		});
		const pages = appendGafSocketMessageToInfinitePages([[opt]], incoming, {
			myUserId: 'me',
		});
		expect(pages[0]?.map((m) => m.id)).toEqual(['server-1']);
	});
});
