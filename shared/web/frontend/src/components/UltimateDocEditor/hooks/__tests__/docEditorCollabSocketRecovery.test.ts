/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locks for doc-collab auto-rejoin after desktop Socket.IO restore (no page refresh).
 */

import { describe, expect, it } from 'vitest';
import { shouldRejoinDocCollabOnSocketRestored } from '../docEditorCollabSocketRecovery';

describe('shouldRejoinDocCollabOnSocketRestored', () => {
	it('does not rejoin when user has no pending join', () => {
		expect(
			shouldRejoinDocCollabOnSocketRestored({
				hasPendingJoin: false,
				freshSocket: {},
				currentSocket: {},
				borrowed: true,
				currentConnected: false,
			})
		).toBe(false);
	});

	it('rejoins when Services.socket instance was replaced (forceNew/supersede)', () => {
		const oldSock = { id: 'old' };
		const newSock = { id: 'new' };
		expect(
			shouldRejoinDocCollabOnSocketRestored({
				hasPendingJoin: true,
				freshSocket: newSock,
				currentSocket: oldSock,
				borrowed: true,
				currentConnected: false,
			})
		).toBe(true);
	});

	it('rejoins when borrowed session is disconnected', () => {
		const sock = { id: 'same' };
		expect(
			shouldRejoinDocCollabOnSocketRestored({
				hasPendingJoin: true,
				freshSocket: sock,
				currentSocket: sock,
				borrowed: true,
				currentConnected: false,
			})
		).toBe(true);
	});

	it('skips rejoin when already connected on the live instance', () => {
		const sock = { id: 'live' };
		expect(
			shouldRejoinDocCollabOnSocketRestored({
				hasPendingJoin: true,
				freshSocket: sock,
				currentSocket: sock,
				borrowed: true,
				currentConnected: true,
			})
		).toBe(false);
	});
});
