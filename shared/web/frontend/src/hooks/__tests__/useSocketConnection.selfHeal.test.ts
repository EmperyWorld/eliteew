/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract lock — useSocketConnection imports unified Socket.IO transport/self-heal policy.
 *
 * Related:
 * - hooks/useSocketConnection.tsx
 * - services/auth/socketIoClientPolicy.ts
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ELITEEW_SOCKET_IO_TRANSPORTS } from '@/services/auth/socketIoClientPolicy';

describe('useSocketConnection transport contract', () => {
	it('uses shared websocket-first transport policy helpers', () => {
		const src = readFileSync(
			resolve(import.meta.dirname, '../useSocketConnection.tsx'),
			'utf8'
		);
		expect(src).toContain('eliteewSocketIoTransportOptions');
		expect(src).toContain('shouldForceNewOnTransportDisconnect');
		expect(src).toContain('disableSocketIoAutoReconnect');
		expect(src).toContain('resolveSocketIoHttpOrigin');
		expect(ELITEEW_SOCKET_IO_TRANSPORTS).toEqual(['websocket', 'polling']);
	});
});
