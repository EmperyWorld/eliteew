/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression lock for socket connection external store decoupled from GAFChatProvider.
 *
 * Invariants:
 * - Followers always read connected=false.
 *
 * Related:
 * - `services/communication/socketConnectionStore.ts`
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
	getSocketConnectionSnapshot,
	resetSocketConnectionStore,
	setSocketConnectionConnected,
	setSocketConnectionLeader,
} from '../socketConnectionStore';

afterEach(() => {
	resetSocketConnectionStore();
});

describe('socketConnectionStore', () => {
	it('keeps followers disconnected even when connect flag is set', () => {
		setSocketConnectionLeader(false);
		setSocketConnectionConnected(true);
		expect(getSocketConnectionSnapshot()).toEqual({
			connected: false,
			isLeader: false,
		});
	});

	it('updates leader connection snapshot', () => {
		setSocketConnectionLeader(true);
		setSocketConnectionConnected(true);
		expect(getSocketConnectionSnapshot()).toEqual({
			connected: true,
			isLeader: true,
		});
		setSocketConnectionConnected(false);
		expect(getSocketConnectionSnapshot().connected).toBe(false);
	});
});
