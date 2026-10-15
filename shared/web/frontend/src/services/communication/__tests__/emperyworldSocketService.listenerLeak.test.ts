/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Listener leak regression: launchSocketIoHandshake must teardown before creating a new io().
 *
 * Related:
 * - services/communication/EmperyworldSocketService.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io-client';

const ioMock = vi.hoisted(() => vi.fn());

vi.mock('socket.io-client', () => ({
	io: (...args: unknown[]) => ioMock(...args),
}));

vi.mock('../../authSession', () => ({
	getToken: vi.fn(() => 'token-test'),
	ensureAccessTokenMinValidity: vi.fn(async () => undefined),
}));

vi.mock('../../maintenance/maintenanceState', () => ({
	getCurrentMaintenanceStatus: vi.fn(() => ({ active: false })),
	isMaintenanceGatePhase: vi.fn(() => false),
	publishMaintenanceStatus: vi.fn(),
}));

vi.mock('../../maintenance/reloadCircuitBreaker', () => ({
	shouldBlockAutoReload: vi.fn(() => false),
}));

vi.mock('../../../utils/staleBundleReload', () => ({
	isBundleBuildMismatch: vi.fn(() => false),
	reloadAllAppTabs: vi.fn(),
}));

type MockSocket = Socket & {
	onCallCount: number;
};

function createCountingMockSocket(id: string): MockSocket {
	let onCallCount = 0;
	const handlers = new Map<string, (...args: unknown[]) => void>();
	const socket = {
		id,
		connected: false,
		get onCallCount() {
			return onCallCount;
		},
		io: {
			opts: {
				reconnection: true,
				auth: {},
			},
			engine: {
				transport: { name: 'websocket' },
			},
		},
		on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
			onCallCount += 1;
			handlers.set(event, handler);
		}),
		once: vi.fn(),
		off: vi.fn(),
		removeAllListeners: vi.fn(() => {
			handlers.clear();
		}),
		disconnect: vi.fn(() => {
			socket.connected = false;
		}),
		connect: vi.fn(() => {
			socket.connected = true;
		}),
		emit: vi.fn(),
	} as unknown as MockSocket;
	return socket;
}

type ServiceInternals = {
	launchSocketIoHandshake: (accessToken: string) => void;
};

describe('EmperyworldSocketService listener leak guard', () => {
	beforeEach(() => {
		ioMock.mockReset();
		vi.resetModules();
	});

	it('does not grow listener registrations linearly across 5 handshakes', async () => {
		const sockets = Array.from({ length: 5 }, (_, i) =>
			createCountingMockSocket(`sid-${i}`)
		);
		for (const socket of sockets) {
			ioMock.mockReturnValueOnce(socket);
		}

		const { EmperyworldSocketService } = await import(
			'../../communication/EmperyworldSocketService'
		);
		const service = new EmperyworldSocketService();
		const launch = (service as unknown as ServiceInternals)
			.launchSocketIoHandshake;

		for (let i = 0; i < 5; i += 1) {
			launch.call(service, 'token-test');
		}

		const lastSocket = sockets[4];
		expect(ioMock).toHaveBeenCalledTimes(5);
		for (const socket of sockets.slice(0, 4)) {
			expect(socket.removeAllListeners).toHaveBeenCalled();
			expect(socket.disconnect).toHaveBeenCalled();
		}
		expect(lastSocket.onCallCount).toBeLessThan(30);
		expect(lastSocket.onCallCount).toBeGreaterThan(10);
		const leakedLinearGrowth = lastSocket.onCallCount >= 5 * 10;
		expect(leakedLinearGrowth).toBe(false);
	});
});
