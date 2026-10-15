/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression locks for unified Socket.IO transport policy and forceNew self-healing triggers.
 *
 * Related:
 * - services/auth/socketIoClientPolicy.ts
 * - hooks/useSocketConnection.tsx, services/communication/EmperyworldSocketService.ts
 */

import { describe, expect, it } from 'vitest';

import { parseSocketConnectError } from '../authenticatedSocketAuth';
import {
	ELITEEW_SOCKET_IO_TRANSPORTS,
	eliteewSocketIoTransportOptions,
	planForceNewReconnectAfterConnectError,
	planForceNewReconnectAfterTransportDisconnect,
	shouldForceNewOnTransportDisconnect,
} from '../socketIoClientPolicy';

describe('socketIoClientPolicy transport unification', () => {
	it('exposes websocket-first transport order for all clients', () => {
		expect(ELITEEW_SOCKET_IO_TRANSPORTS).toEqual(['websocket', 'polling']);
		expect(eliteewSocketIoTransportOptions().transports).toEqual([
			'websocket',
			'polling',
		]);
	});

	it('matches API config socketIO.transports', async () => {
		const { API_CONFIG } = await import('../../api/config');
		expect(API_CONFIG.socketIO.transports).toEqual(['websocket', 'polling']);
	});
});

describe('socketIoClientPolicy self-healing forceNew', () => {
	it('does not forceNew on transport close or ping timeout (same Engine.IO sid)', () => {
		expect(shouldForceNewOnTransportDisconnect('transport close')).toBe(false);
		expect(shouldForceNewOnTransportDisconnect('ping timeout')).toBe(false);
		expect(shouldForceNewOnTransportDisconnect('io client disconnect')).toBe(
			false
		);
	});

	it('transport close does not plan a new sid (lease race)', () => {
		expect(
			planForceNewReconnectAfterTransportDisconnect('transport close')
		).toBe(null);
	});

	it('stale Engine.IO session (HTTP 400) plans forceNew reconnect', () => {
		const parsed = parseSocketConnectError({
			message: 'xhr poll error',
			description: 400,
		});
		const plan = planForceNewReconnectAfterConnectError(parsed);
		expect(plan).toEqual({
			forceNew: true,
			reason: 'stale_engine_session',
		});
		expect(parsed.isStaleEngineSession).toBe(true);
	});
});
