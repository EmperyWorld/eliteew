/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services', () => ({
	Services: {
		socket: {
			isConnected: vi.fn(() => false),
			connect: vi.fn(async () => ({
				success: true,
				data: { connected: true, session_id: 's1' },
			})),
		},
	},
}));

vi.mock('@/services/keycloak', () => ({
	getUserInfo: vi.fn(() => ({ id: 'u1', username: 'tester' })),
	isAuthenticated: vi.fn(() => true),
}));

vi.mock('@/services/maintenance/reloadCircuitBreaker', () => ({
	clearReloadCircuitWhenHealthy: vi.fn(async () => true),
}));

const publishMaintenanceStatus = vi.fn();
vi.mock('@/services/maintenance/maintenanceState', () => ({
	fetchMaintenanceStatus: vi.fn(async () => ({ active: false, window: null })),
	publishMaintenanceStatus: (...args: unknown[]) =>
		publishMaintenanceStatus(...args),
}));

import { Services } from '@/services';
import { performDesktopSoftRecovery } from '@/services/maintenance/performDesktopSoftRecovery';

describe('performDesktopSoftRecovery', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('refreshes storage, socket and maintenance store when healthy', async () => {
		const refresh = vi.fn(async () => undefined);
		const ok = await performDesktopSoftRecovery(refresh);
		expect(ok).toBe(true);
		expect(refresh).toHaveBeenCalledTimes(1);
		expect(Services.socket.connect).toHaveBeenCalled();
		expect(publishMaintenanceStatus).toHaveBeenCalledWith({
			active: false,
			window: null,
		});
	});
});
