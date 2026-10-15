/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Discussion control visibility matrix.
 */
import { describe, expect, it } from 'vitest';
import {
	discussionBlocksNormalChatSend,
	discussionControlVisibility,
} from '../discussionControls';

describe('discussionControlVisibility', () => {
	it('enables composer on any paused_* awaiting Continue', () => {
		expect(discussionControlVisibility('running').composerEnabled).toBe(false);
		expect(discussionControlVisibility('paused_user').composerEnabled).toBe(
			true
		);
		expect(
			discussionControlVisibility('paused_checkpoint').composerEnabled
		).toBe(true);
		expect(discussionControlVisibility('paused_goal').composerEnabled).toBe(
			true
		);
		expect(discussionControlVisibility('paused_error').composerEnabled).toBe(
			true
		);
	});

	it('keeps continue after raise-hand pause', () => {
		const v = discussionControlVisibility('paused_user');
		expect(v.continue).toBe(true);
		expect(v.raiseHand).toBe(false);
		expect(v.generateDocument).toBe(true);
	});

	it('allows document from paused/completed only', () => {
		expect(discussionControlVisibility('queued').generateDocument).toBe(false);
		expect(discussionControlVisibility('running').generateDocument).toBe(false);
		expect(discussionControlVisibility('completed').generateDocument).toBe(
			true
		);
	});

	it('blocks normal chat send only while queued/running', () => {
		expect(discussionBlocksNormalChatSend('queued')).toBe(true);
		expect(discussionBlocksNormalChatSend('running')).toBe(true);
		expect(discussionBlocksNormalChatSend('paused_user')).toBe(false);
		expect(discussionBlocksNormalChatSend('completed')).toBe(false);
		expect(discussionBlocksNormalChatSend('cancelled')).toBe(false);
		expect(discussionBlocksNormalChatSend(null)).toBe(false);
	});
});
