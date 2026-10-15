import { describe, expect, it } from 'vitest';
import { getServiceConfig } from '../ServiceConfig';

/**
 * Contract: ServiceConfig base URLs stay aligned with FastAPI mounts.
 * Prefer /api/v1 where the backend exposes a duplicate (e.g. monitoring logs in main.py).
 */
describe('ServiceConfig path contract', () => {
	it('Empery World service uses legacy /api/emperyworld base (AuthService config retired)', () => {
		const bro = getServiceConfig('EMPERYWORLD');
		expect(bro.endpoints.baseUrl).toBe('/api/emperyworld');
	});

	it('Monitoring service base remains /api/monitoring for BaseService relative paths', () => {
		const mon = getServiceConfig('MONITORING');
		expect(mon.endpoints.baseUrl).toBe('/api/monitoring');
	});

	it('WEBSOCKET config points at Socket.IO, not retired /ws echo', () => {
		const ws = getServiceConfig('WEBSOCKET');
		expect(ws.serviceName).toBe('EmperyworldSocketService');
		expect(ws.endpoints.endpoints.main).toBe('/socket.io/');
		expect(ws.endpoints.baseUrl).not.toContain('/ws');
	});
});
