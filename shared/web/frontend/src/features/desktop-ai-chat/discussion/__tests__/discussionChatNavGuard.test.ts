/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest lock for Discussion setup chat-switch guard.
 *
 * Invariants: — (нет)
 *
 * Related:
 * - discussionChatNavGuard.ts
 */
import { describe, expect, it } from 'vitest';
import { shouldBlockChatSwitchForDiscussionSetup } from '../discussionChatNavGuard';

describe('shouldBlockChatSwitchForDiscussionSetup', () => {
	it('allows switch when setup is closed', () => {
		expect(
			shouldBlockChatSwitchForDiscussionSetup({
				discussionSetupOpen: false,
				discussionSetupChatId: 'a',
				targetChatId: 'b',
			})
		).toBe(false);
	});

	it('allows same-chat reselect while setup open', () => {
		expect(
			shouldBlockChatSwitchForDiscussionSetup({
				discussionSetupOpen: true,
				discussionSetupChatId: 'a',
				targetChatId: 'a',
			})
		).toBe(false);
	});

	it('blocks switch to another chat while setup open', () => {
		expect(
			shouldBlockChatSwitchForDiscussionSetup({
				discussionSetupOpen: true,
				discussionSetupChatId: 'a',
				targetChatId: 'b',
			})
		).toBe(true);
	});

	it('blocks clear-selection while setup open', () => {
		expect(
			shouldBlockChatSwitchForDiscussionSetup({
				discussionSetupOpen: true,
				discussionSetupChatId: 'a',
				targetChatId: null,
			})
		).toBe(true);
	});
});
