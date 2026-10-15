/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest lock for Discussion anchor helpers.
 *
 * Invariants: — (нет)
 *
 * Related:
 * - discussionAnchors.ts
 */
import { describe, expect, it } from 'vitest';
import type { DesktopAiMessage } from '../../api/desktopChatClient';
import {
	isDesktopDiscussionAnchorMessage,
	latestDiscussionSessionIdFromMessages,
} from '../discussionAnchors';

function msg(
	id: string,
	overrides: Partial<DesktopAiMessage> = {}
): DesktopAiMessage {
	return {
		id,
		role: 'assistant',
		content: '',
		created_at: '2026-08-07T00:00:00.000Z',
		...overrides,
	};
}

describe('discussionAnchors', () => {
	it('detects desktop_discussion metadata', () => {
		expect(
			isDesktopDiscussionAnchorMessage(
				msg('a', { metadata: { desktop_discussion: true } })
			)
		).toBe(true);
		expect(isDesktopDiscussionAnchorMessage(msg('b'))).toBe(false);
	});

	it('returns newest discussion_session_id from anchors', () => {
		const id = latestDiscussionSessionIdFromMessages([
			msg('1', {
				metadata: {
					desktop_discussion: true,
					discussion_session_id: 'old',
				},
			}),
			msg('2', { content: 'normal' }),
			msg('3', {
				metadata: {
					desktop_discussion: true,
					discussion_session_id: 'new',
				},
			}),
		]);
		expect(id).toBe('new');
	});
});
