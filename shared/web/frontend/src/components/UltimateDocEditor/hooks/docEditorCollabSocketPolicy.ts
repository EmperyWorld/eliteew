/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure policy for doc-editor Socket.IO: borrow desktop socket vs dedicated io() vs skip on follower tabs.
 *
 * Invariants:
 * - Follower tabs under single-tab policy must never open a dedicated Socket.IO client.
 * - Desktop leader must prefer borrowed Services.socket over a second io() (forceNew does not override).
 *
 * Related:
 * - useCollaboration.ts, documentation/platform/BUG-MULTI-TAB-BROWSER-PRESENCE-OPEN-2026-05-23.md
 */

export type DocEditorCollabSocketPlan =
	| 'borrow'
	| 'create_dedicated'
	| 'skip_follower'
	| 'skip_leader_wait';

export function planDocEditorCollabSocket(input: {
	forceNew: boolean;
	sharedSocketAvailable: boolean;
	singleTabPolicyEnabled: boolean;
	isSocketOwner: boolean;
	leaderSharedSocketAvailableAfterWait: boolean;
}): DocEditorCollabSocketPlan {
	// Under single-tab desktop policy, never open a second io() — even if forceNew.
	if (
		input.sharedSocketAvailable &&
		(!input.forceNew || input.singleTabPolicyEnabled)
	) {
		return 'borrow';
	}
	if (input.singleTabPolicyEnabled && !input.isSocketOwner) {
		return 'skip_follower';
	}
	if (input.singleTabPolicyEnabled && input.isSocketOwner) {
		return input.leaderSharedSocketAvailableAfterWait
			? 'borrow'
			: 'skip_leader_wait';
	}
	return 'create_dedicated';
}
