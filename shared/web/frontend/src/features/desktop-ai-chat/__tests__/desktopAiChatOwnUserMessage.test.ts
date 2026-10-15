/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit lock for shared-chat own-vs-peer user bubble attribution helper.
 *
 * Invariants:
 * - Solo: missing author / self → own (optimistic).
 * - Shared: missing self or author (without owner fallback) → not own.
 *
 * Related:
 * - utils/desktopAiChatOwnUserMessage.ts
 */
import { describe, expect, it } from 'vitest';
import {
	desktopAiChatAuthorInitials,
	isDesktopAiChatOwnUserMessage,
} from '../utils/desktopAiChatOwnUserMessage';

describe('isDesktopAiChatOwnUserMessage', () => {
	it('treats assistant as not own-user', () => {
		expect(
			isDesktopAiChatOwnUserMessage(
				{ role: 'assistant', author_user_id: 'u1' },
				'u1'
			)
		).toBe(false);
	});

	it('treats missing author as own in solo / optimistic', () => {
		expect(isDesktopAiChatOwnUserMessage({ role: 'user' }, 'u1')).toBe(true);
		expect(
			isDesktopAiChatOwnUserMessage(
				{ role: 'user', author_user_id: 'u2' },
				null
			)
		).toBe(true);
	});

	it('shared: missing self is never own', () => {
		expect(
			isDesktopAiChatOwnUserMessage(
				{ role: 'user', author_user_id: 'owner' },
				null,
				{ isSharedChat: true, ownerUserId: 'owner' }
			)
		).toBe(false);
	});

	it('shared: null author falls back to owner id', () => {
		expect(
			isDesktopAiChatOwnUserMessage({ role: 'user' }, 'guest', {
				isSharedChat: true,
				ownerUserId: 'owner',
			})
		).toBe(false);
		expect(
			isDesktopAiChatOwnUserMessage({ role: 'user' }, 'owner', {
				isSharedChat: true,
				ownerUserId: 'owner',
			})
		).toBe(true);
	});

	it('matches author_user_id to current viewer', () => {
		expect(
			isDesktopAiChatOwnUserMessage(
				{ role: 'user', author_user_id: 'u1' },
				'u1'
			)
		).toBe(true);
		expect(
			isDesktopAiChatOwnUserMessage(
				{ role: 'user', author_user_id: 'u2' },
				'u1'
			)
		).toBe(false);
	});
});

describe('desktopAiChatAuthorInitials', () => {
	it('builds initials from one or two words', () => {
		expect(desktopAiChatAuthorInitials('Alice')).toBe('AL');
		expect(desktopAiChatAuthorInitials('Alice Bob')).toBe('AB');
		expect(desktopAiChatAuthorInitials('  ')).toBe('?');
	});
});
