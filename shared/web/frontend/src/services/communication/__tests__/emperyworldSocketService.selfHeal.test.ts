/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for EmperyworldSocketService transport policy and forceNew self-healing.
 *
 * Related:
 * - services/communication/EmperyworldSocketService.ts
 * - services/auth/socketIoClientPolicy.ts
 */

import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
	trigger: (event: string, ...args: unknown[]) => void;
};

function createMockSocket(
	id: string,
	options?: { fireConnectOnConnect?: boolean }
): MockSocket {
	const fireConnectOnConnect = options?.fireConnectOnConnect ?? true;
	const handlers = new Map<string, (...args: unknown[]) => void>();
	const socket = {
		id,
		connected: false,
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
			handlers.set(event, handler);
		}),
		once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
			handlers.set(event, handler);
		}),
		off: vi.fn(),
		removeAllListeners: vi.fn(() => {
			handlers.clear();
		}),
		disconnect: vi.fn(() => {
			socket.connected = false;
		}),
		connect: vi.fn(() => {
			socket.connected = true;
			if (fireConnectOnConnect) {
				queueMicrotask(() => {
					handlers.get('connect')?.();
				});
			}
		}),
		emit: vi.fn(),
		trigger(event: string, ...args: unknown[]) {
			handlers.get(event)?.(...args);
		},
	} as unknown as MockSocket;
	return socket;
}

describe('EmperyworldSocketService socket policy', () => {
	beforeEach(async () => {
		ioMock.mockReset();
		vi.resetModules();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('connects with websocket-first transports', async () => {
		const firstSocket = createMockSocket('sid-initial');
		ioMock.mockReturnValueOnce(firstSocket);

		const { EmperyworldSocketService } = await import(
			'../../communication/EmperyworldSocketService'
		);
		const service = new EmperyworldSocketService();

		const connectPromise = service.connect({
			user_id: 'user-1',
			user_name: 'Tester',
			capabilities: ['chat'],
		});
		await waitFor(() => {
			expect(ioMock).toHaveBeenCalled();
		});
		await connectPromise;

		expect(ioMock).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				path: '/socket.io/',
				transports: ['websocket', 'polling'],
				forceNew: false,
			})
		);
	});

	it('transport close keeps the Engine.IO session (no immediate forceNew sid)', async () => {
		const firstSocket = createMockSocket('sid-live');
		ioMock.mockReturnValueOnce(firstSocket);

		const { EmperyworldSocketService } = await import(
			'../../communication/EmperyworldSocketService'
		);
		const service = new EmperyworldSocketService();

		const connectPromise = service.connect({
			user_id: 'user-1',
			user_name: 'Tester',
			capabilities: ['chat'],
		});
		await waitFor(() => {
			expect(ioMock).toHaveBeenCalled();
		});
		await connectPromise;

		expect(firstSocket.connected).toBe(true);
		firstSocket.trigger('disconnect', 'transport close');

		await new Promise((resolve) => {
			setTimeout(resolve, 50);
		});
		expect(ioMock).toHaveBeenCalledTimes(1);
		expect(ioMock.mock.calls[0]?.[1]).toEqual(
			expect.objectContaining({
				transports: ['websocket', 'polling'],
				forceNew: false,
			})
		);
	});

	it('stale Engine.IO session (400) reconnects with forceNew', async () => {
		const firstSocket = createMockSocket('sid-stale', {
			fireConnectOnConnect: false,
		});
		const secondSocket = createMockSocket('sid-fresh');
		ioMock.mockReturnValueOnce(firstSocket).mockReturnValueOnce(secondSocket);

		const { EmperyworldSocketService } = await import(
			'../../communication/EmperyworldSocketService'
		);
		const service = new EmperyworldSocketService();

		const connectPromise = service.connect({
			user_id: 'user-1',
			user_name: 'Tester',
			capabilities: ['chat'],
		});

		await waitFor(() => {
			expect(ioMock).toHaveBeenCalled();
		});

		firstSocket.trigger('connect_error', {
			message: 'xhr poll error',
			description: 400,
		});

		await vi.waitFor(
			() => {
				expect(ioMock).toHaveBeenCalledTimes(2);
			},
			{ timeout: 2000 }
		);

		await connectPromise;

		expect(ioMock.mock.calls[1]?.[1]).toEqual(
			expect.objectContaining({
				transports: ['websocket', 'polling'],
				forceNew: true,
			})
		);
		expect(secondSocket.connected).toBe(true);
	});

	it('single browser realtime reject retries after short lease delay', async () => {
		vi.useFakeTimers();
		const firstSocket = createMockSocket('sid-lease-conflict', {
			fireConnectOnConnect: false,
		});
		const secondSocket = createMockSocket('sid-after-retry');
		ioMock.mockReturnValueOnce(firstSocket).mockReturnValueOnce(secondSocket);

		const { EmperyworldSocketService } = await import(
			'../../communication/EmperyworldSocketService'
		);
		const service = new EmperyworldSocketService();

		const connectPromise = service.connect({
			user_id: 'user-1',
			user_name: 'Tester',
			capabilities: ['chat'],
		});
		await Promise.resolve();

		expect(ioMock).toHaveBeenCalledTimes(1);

		firstSocket.trigger('connect_error', {
			message: 'Connection rejected by server',
			data: { reason: 'single_browser_realtime' },
		});

		await vi.advanceTimersByTimeAsync(1300);
		await Promise.resolve();

		expect(ioMock).toHaveBeenCalledTimes(2);

		await connectPromise;

		expect(ioMock.mock.calls[1]?.[1]).toEqual(
			expect.objectContaining({
				transports: ['websocket', 'polling'],
				forceNew: false,
			})
		);
		expect(secondSocket.connected).toBe(true);
	});
});
