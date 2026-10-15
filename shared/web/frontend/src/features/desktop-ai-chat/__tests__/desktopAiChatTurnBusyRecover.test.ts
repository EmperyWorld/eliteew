/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock soft-recover helpers for concurrent turn_in_progress (409) UX.
 */
import { describe, expect, it } from 'vitest';
import type { DesktopAiMessage } from '../api/desktopChatClient';
import {
	isDesktopAiChatOwnerForStreamLockClear,
	stripDesktopAiOptimisticLocalMessages,
} from '../utils/desktopAiChatTurnBusyRecover';

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

describe('desktopAiChatTurnBusyRecover', () => {
	it('strips only local-* optimistic rows', () => {
		const out = stripDesktopAiOptimisticLocalMessages([
			msg({ id: 'persisted', role: 'user', content: 'keep' }),
			msg({ id: 'local-1', role: 'user', content: 'drop' }),
			msg({ id: 'local-a-2', role: 'assistant', content: '' }),
		]);
		expect(out.map((m) => m.id)).toEqual(['persisted']);
	});

	it('recognizes owner via viewer_role or owner id match', () => {
		expect(
			isDesktopAiChatOwnerForStreamLockClear({
				viewerRole: 'owner',
				ownerUserId: 'o1',
				currentUserId: 'u2',
			})
		).toBe(true);
		expect(
			isDesktopAiChatOwnerForStreamLockClear({
				viewerRole: 'member',
				ownerUserId: 'u1',
				currentUserId: 'u1',
			})
		).toBe(true);
		expect(
			isDesktopAiChatOwnerForStreamLockClear({
				viewerRole: 'member',
				ownerUserId: 'o1',
				currentUserId: 'u2',
			})
		).toBe(false);
	});
});
