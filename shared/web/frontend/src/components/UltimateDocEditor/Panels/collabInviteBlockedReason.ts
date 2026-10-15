/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Honest i18n key for why collaboration invite actions are disabled.
 *
 * Invariants:
 * - Owner gate beats connect gate when the user is already in a collab session.
 *
 * Related:
 * - CollaborationPanel.tsx, useDocEditorPanelOverlaysProps.ts
 */

export type CollabInviteBlockedReason = 'owner' | 'connect';

/**
 * When invites are disabled, pick a user-facing reason that matches ACL/state —
 * not a single «connect first» string for every case.
 */
export function resolveCollabInviteBlockedReason(input: {
	canSendInvites: boolean;
	isDocumentOwner: boolean;
}): CollabInviteBlockedReason | null {
	if (input.canSendInvites) {
		return null;
	}
	if (!input.isDocumentOwner) {
		return 'owner';
	}
	return 'connect';
}

export function collabInviteBlockedMessageKey(
	reason: CollabInviteBlockedReason | null
): 'collab.inviteRequiresOwner' | 'collab.inviteRequiresConnect' | null {
	if (reason === 'owner') {
		return 'collab.inviteRequiresOwner';
	}
	if (reason === 'connect') {
		return 'collab.inviteRequiresConnect';
	}
	return null;
}
