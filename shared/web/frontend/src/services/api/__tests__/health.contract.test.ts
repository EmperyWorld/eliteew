/**
 * Contract smoke: shapes of health-related JSON from shared/api/main.py.
 * No HTTP call — avoids flaking when the stack is down; run integration checks via pytest + TestClient.
 */
import { describe, expect, it } from 'vitest';

/** Mirrors shared/api/main.py health_check JSON keys. */
function assertPrimaryHealthPayload(body: unknown): asserts body is {
	status: string;
	message: string;
	timestamp: string;
	version: string;
} {
	if (typeof body !== 'object' || body === null) {
		throw new Error('health body must be an object');
	}
	const o = body as Record<string, unknown>;
	for (const key of ['status', 'message', 'timestamp', 'version'] as const) {
		if (typeof o[key] !== 'string') {
			throw new Error(`health body missing string field ${key}`);
		}
	}
}

/** Mirrors shared/api/main.py _api_health_payload() success and error branches. */
function assertApiHealthPayload(body: unknown): asserts body is {
	status: string;
	message: string;
	api_version: string;
	timestamp: string;
	services: Record<string, string>;
	ecosystem_services: number;
} {
	if (typeof body !== 'object' || body === null) {
		throw new Error('api health body must be an object');
	}
	const o = body as Record<string, unknown>;
	for (const key of [
		'status',
		'message',
		'api_version',
		'timestamp',
	] as const) {
		if (typeof o[key] !== 'string') {
			throw new Error(`api health body missing string field ${key}`);
		}
	}
	if (
		typeof o.services !== 'object' ||
		o.services === null ||
		Array.isArray(o.services)
	) {
		throw new Error('api health body services must be a plain object');
	}
	for (const v of Object.values(o.services as Record<string, unknown>)) {
		if (typeof v !== 'string') {
			throw new Error('api health body services values must be strings');
		}
	}
	if (
		typeof o.ecosystem_services !== 'number' ||
		Number.isNaN(o.ecosystem_services)
	) {
		throw new Error('api health body ecosystem_services must be a number');
	}
}

/** Mirrors shared/api/main.py api_v1_ping. */
function assertApiV1PingPayload(body: unknown): asserts body is {
	status: string;
	timestamp: string;
} {
	if (typeof body !== 'object' || body === null) {
		throw new Error('ping body must be an object');
	}
	const o = body as Record<string, unknown>;
	if (typeof o.status !== 'string') {
		throw new Error('ping body missing string status');
	}
	if (typeof o.timestamp !== 'string') {
		throw new Error('ping body missing string timestamp');
	}
}

describe('GET /health contract', () => {
	it('accepts a minimal valid payload', () => {
		const sample = {
			status: 'healthy',
			message: 'Production ready',
			timestamp: '2026-04-03T12:00:00+00:00',
			version: '4.0.0',
		};
		expect(() => assertPrimaryHealthPayload(sample)).not.toThrow();
	});

	it('rejects wrong shapes', () => {
		expect(() => assertPrimaryHealthPayload(null)).toThrow();
		expect(() => assertPrimaryHealthPayload({ status: 1 })).toThrow();
		expect(() =>
			assertPrimaryHealthPayload({
				status: 'healthy',
				message: '',
				timestamp: 't',
				version: 'v',
			})
		).not.toThrow();
	});
});

describe('GET /api/v1/health (shared _api_health_payload)', () => {
	it('accepts a healthy-style payload', () => {
		const sample = {
			status: 'healthy',
			message: 'Production ready',
			api_version: '4.1.1',
			timestamp: '2026-04-18T12:00:00+00:00',
			services: { stack1: 'healthy' },
			ecosystem_services: 12,
		};
		expect(() => assertApiHealthPayload(sample)).not.toThrow();
	});

	it('accepts an unhealthy-style payload (exception branch)', () => {
		const sample = {
			status: 'unhealthy',
			message: 'connection refused',
			api_version: '4.1.1',
			timestamp: '2026-04-18T12:00:00+00:00',
			services: {},
			ecosystem_services: 12,
		};
		expect(() => assertApiHealthPayload(sample)).not.toThrow();
	});

	it('rejects wrong shapes', () => {
		expect(() => assertApiHealthPayload(null)).toThrow();
		expect(() =>
			assertApiHealthPayload({
				status: 'healthy',
				message: '',
				api_version: 'v',
				timestamp: 't',
				services: { a: 1 },
				ecosystem_services: 0,
			})
		).toThrow();
		expect(() =>
			assertApiHealthPayload({
				status: 'healthy',
				message: '',
				api_version: 'v',
				timestamp: 't',
				services: {},
				ecosystem_services: NaN,
			})
		).toThrow();
	});
});

describe('GET /api/v1/ping', () => {
	it('accepts the canonical payload', () => {
		const sample = { status: 'ok', timestamp: '2026-04-18T12:00:00+00:00' };
		expect(() => assertApiV1PingPayload(sample)).not.toThrow();
	});

	it('rejects wrong shapes', () => {
		expect(() => assertApiV1PingPayload(null)).toThrow();
		expect(() => assertApiV1PingPayload({ status: 'ok' })).toThrow();
	});
});
