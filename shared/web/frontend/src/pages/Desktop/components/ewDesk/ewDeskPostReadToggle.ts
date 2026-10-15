/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve read/unread toggle action for an EWDesk post from current read markers.
 *
 * Related:
 * - EWDeskApp.tsx, useEwDeskUserStateSync.ts
 */

export type EwDeskPostReadToggleAction = 'mark_read' | 'mark_unread';

export function resolveEwDeskPostReadToggleAction(
	postId: string,
	readIds: ReadonlySet<string>
): EwDeskPostReadToggleAction {
	return readIds.has(postId) ? 'mark_unread' : 'mark_read';
}
