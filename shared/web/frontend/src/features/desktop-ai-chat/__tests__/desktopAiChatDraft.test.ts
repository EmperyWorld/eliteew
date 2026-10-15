/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for Desktop AI Chat draft localStorage helpers.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - utils/desktopAiChatDraft.ts
 * ---
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	chatDraftKey,
	DRAFT_STORAGE_PREFIX,
	persistChatDraft,
	readChatHasDraft,
	removeChatDraft,
} from '../utils/desktopAiChatDraft';

function installLocalStorageMock(): Map<string, string> {
	const store = new Map<string, string>();
	const mock = {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => {
			store.set(key, value);
		},
		removeItem: (key: string) => {
			store.delete(key);
		},
		clear: () => {
			store.clear();
		},
		get length() {
			return store.size;
		},
	};
	vi.stubGlobal('localStorage', mock);
	return store;
}

describe('desktopAiChatDraft', () => {
	const chatId = 'chat-test-1';
	let store: Map<string, string>;

	beforeEach(() => {
		store = installLocalStorageMock();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('chatDraftKey scopes by chat id', () => {
		expect(chatDraftKey(chatId)).toBe(`${DRAFT_STORAGE_PREFIX}${chatId}`);
	});

	it('persistChatDraft stores non-empty text and clears empty', () => {
		persistChatDraft(chatId, 'hello');
		expect(localStorage.getItem(chatDraftKey(chatId))).toBe('hello');
		expect(readChatHasDraft(chatId)).toBe(true);

		persistChatDraft(chatId, '   ');
		expect(localStorage.getItem(chatDraftKey(chatId))).toBeNull();
		expect(readChatHasDraft(chatId)).toBe(false);
	});

	it('persistChatDraft ignores null chat id', () => {
		persistChatDraft(null, 'ignored');
		expect(store.size).toBe(0);
	});

	it('removeChatDraft clears stored draft', () => {
		persistChatDraft(chatId, 'draft');
		removeChatDraft(chatId);
		expect(readChatHasDraft(chatId)).toBe(false);
	});
});
