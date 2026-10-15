/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure decision helper: when desktop Services.socket restores after supersede/forceNew,
 * should doc-editor collab re-bind join_document without a page refresh.
 *
 * Invariants:
 * - No pending join → never rejoin (user left or never started).
 * - Stale borrowed io() instance or disconnected session → rejoin.
 *
 * Related:
 * - useCollaboration.ts, docEditorCollabSocketPolicy.ts
 */

export function shouldRejoinDocCollabOnSocketRestored(input: {
	hasPendingJoin: boolean;
	freshSocket: object | null;
	currentSocket: object | null;
	borrowed: boolean;
	currentConnected: boolean;
}): boolean {
	if (!input.hasPendingJoin) {
		return false;
	}
	const staleInstance =
		input.freshSocket != null &&
		input.currentSocket != null &&
		input.freshSocket !== input.currentSocket;
	if (staleInstance) {
		return true;
	}
	// Dead/missing session while user still expects collab (incl. after borrowed io() teardown).
	if (!input.currentSocket || !input.currentConnected) {
		return true;
	}
	return false;
}
