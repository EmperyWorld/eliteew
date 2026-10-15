import { describe, expect, it } from 'vitest';
import { planDocEditorCollabSocket } from '../docEditorCollabSocketPolicy';

describe('planDocEditorCollabSocket', () => {
	it('prefers borrow when shared socket is available', () => {
		expect(
			planDocEditorCollabSocket({
				forceNew: false,
				sharedSocketAvailable: true,
				singleTabPolicyEnabled: true,
				isSocketOwner: true,
				leaderSharedSocketAvailableAfterWait: false,
			})
		).toBe('borrow');
	});

	it('skips dedicated socket on follower tabs', () => {
		expect(
			planDocEditorCollabSocket({
				forceNew: false,
				sharedSocketAvailable: false,
				singleTabPolicyEnabled: true,
				isSocketOwner: false,
				leaderSharedSocketAvailableAfterWait: false,
			})
		).toBe('skip_follower');
	});

	it('desktop leader waits for shared socket instead of dedicated io', () => {
		expect(
			planDocEditorCollabSocket({
				forceNew: false,
				sharedSocketAvailable: false,
				singleTabPolicyEnabled: true,
				isSocketOwner: true,
				leaderSharedSocketAvailableAfterWait: true,
			})
		).toBe('borrow');
		expect(
			planDocEditorCollabSocket({
				forceNew: false,
				sharedSocketAvailable: false,
				singleTabPolicyEnabled: true,
				isSocketOwner: true,
				leaderSharedSocketAvailableAfterWait: false,
			})
		).toBe('skip_leader_wait');
	});

	it('allows dedicated socket when single-tab policy is off (admin)', () => {
		expect(
			planDocEditorCollabSocket({
				forceNew: false,
				sharedSocketAvailable: false,
				singleTabPolicyEnabled: false,
				isSocketOwner: true,
				leaderSharedSocketAvailableAfterWait: false,
			})
		).toBe('create_dedicated');
	});

	it('follower never creates dedicated io even when forceNew', () => {
		expect(
			planDocEditorCollabSocket({
				forceNew: true,
				sharedSocketAvailable: false,
				singleTabPolicyEnabled: true,
				isSocketOwner: false,
				leaderSharedSocketAvailableAfterWait: false,
			})
		).toBe('skip_follower');
	});

	it('desktop leader prefers borrow over forceNew when shared socket exists', () => {
		expect(
			planDocEditorCollabSocket({
				forceNew: true,
				sharedSocketAvailable: true,
				singleTabPolicyEnabled: true,
				isSocketOwner: true,
				leaderSharedSocketAvailableAfterWait: false,
			})
		).toBe('borrow');
	});
});
