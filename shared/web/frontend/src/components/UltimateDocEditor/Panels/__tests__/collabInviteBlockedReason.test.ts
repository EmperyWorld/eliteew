/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock honest invite-disabled copy (owner vs connect).
 *
 * Invariants:
 * - Connected non-owner must not get «connect first».
 *
 * Related:
 * - collabInviteBlockedReason.ts
 */

import { describe, expect, it } from 'vitest';
import {
	collabInviteBlockedMessageKey,
	resolveCollabInviteBlockedReason,
} from '../collabInviteBlockedReason';

describe('resolveCollabInviteBlockedReason', () => {
	it('returns null when invites are allowed', () => {
		expect(
			resolveCollabInviteBlockedReason({
				canSendInvites: true,
				isDocumentOwner: true,
			})
		).toBeNull();
	});

	it('prefers owner gate over connect when not owner', () => {
		expect(
			resolveCollabInviteBlockedReason({
				canSendInvites: false,
				isDocumentOwner: false,
			})
		).toBe('owner');
		expect(collabInviteBlockedMessageKey('owner')).toBe(
			'collab.inviteRequiresOwner'
		);
	});

	it('asks to connect when owner but invites still blocked', () => {
		expect(
			resolveCollabInviteBlockedReason({
				canSendInvites: false,
				isDocumentOwner: true,
			})
		).toBe('connect');
	});
});
