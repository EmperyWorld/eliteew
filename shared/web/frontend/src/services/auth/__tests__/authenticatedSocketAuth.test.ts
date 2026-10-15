/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for Socket.IO auth helper parsing and payload building.
 *
 * Invariants:
 * - Machine-readable reject reasons from backend map to recovery branches.
 * - OIDC auth refresh patches socket auth without disconnect/connect (no lease churn).
 *
 * Related:
 * - services/auth/authenticatedSocketAuth.ts
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
	bindSocketAuthRefresh,
	buildSocketAuthPayload,
	parseSocketConnectError,
} from '../authenticatedSocketAuth';
import {
	markSessionReplaceConfirmedWindow,
	resetSessionReplaceConfirmationStateForTests,
} from '../ssoSessionReplaceConfirm';

vi.mock('../../../utils/appBuildId', () => ({
	getAppBuildId: () => 'test-build-id',
}));

const authRefreshHandlers: Array<() => void> = [];
vi.mock('../../keycloak', () => ({
	subscribeAuthRefreshSuccess: (handler: () => void) => {
		authRefreshHandlers.push(handler);
		return () => {
			const idx = authRefreshHandlers.indexOf(handler);
			if (idx >= 0) authRefreshHandlers.splice(idx, 1);
		};
	},
}));

vi.mock('../authSessionLock', () => ({
	isAuthSessionLocked: () => false,
}));

vi.mock('../../authSession', () => ({
	default: {
		authenticated: true,
		updateToken: vi.fn(),
	},
	getToken: () => 'fresh-access-token',
}));

describe('parseSocketConnectError', () => {
	it('detects session replace confirmation from structured reject payload', () => {
		const parsed = parseSocketConnectError({
			message: 'Unauthorized',
			data: { reason: 'session_replace_confirmation_required' },
		});
		expect(parsed.isSessionReplaceConfirmationRequired).toBe(true);
		expect(parsed.isAuthFailure).toBe(true);
	});

	it('detects stale client build gate from structured reason', () => {
		const parsed = parseSocketConnectError({
			data: { reason: 'app_build_mismatch' },
		});
		expect(parsed.isStaleClient).toBe(true);
		expect(parsed.isAuthFailure).toBe(false);
	});

	it('does not treat generic app_build substring as stale client', () => {
		const parsed = parseSocketConnectError({
			message: 'connect failed while reading app_build header metadata',
		});
		expect(parsed.isStaleClient).toBe(false);
	});

	it('detects stale Engine.IO session after backend restart (HTTP 400)', () => {
		const parsed = parseSocketConnectError({
			message: 'xhr poll error',
			description: 400,
		});
		expect(parsed.isStaleEngineSession).toBe(true);
		expect(parsed.isAuthFailure).toBe(false);
	});

	it('detects single browser realtime lease conflicts', () => {
		const parsed = parseSocketConnectError({
			message: 'Connection rejected by server',
			data: { reason: 'single_browser_realtime' },
		});
		expect(parsed.isSingleBrowserRealtimeConflict).toBe(true);
		expect(parsed.isAuthFailure).toBe(false);
	});
});

describe('buildSocketAuthPayload', () => {
	it('includes sso_replace_confirm after operator confirmed replace window', () => {
		resetSessionReplaceConfirmationStateForTests();
		markSessionReplaceConfirmedWindow();
		const payload = buildSocketAuthPayload('token-abc', {
			client_type: 'web_client',
		});
		expect(payload.token).toBe('token-abc');
		expect(payload.app_build).toBe('test-build-id');
		expect(payload.sso_replace_confirm).toBe(1);
		expect(payload.client_type).toBe('web_client');
	});
});

describe('bindSocketAuthRefresh', () => {
	beforeEach(() => {
		authRefreshHandlers.length = 0;
	});

	afterEach(() => {
		authRefreshHandlers.length = 0;
	});

	it('patches socket.io auth on refresh without disconnect/connect', () => {
		const disconnect = vi.fn();
		const connect = vi.fn();
		const socket = {
			connected: true,
			disconnect,
			connect,
			io: {
				opts: {
					auth: {
						token: 'stale-token',
						client_type: 'web_client',
					},
				},
			},
		};

		const unsub = bindSocketAuthRefresh(() => socket as never);
		expect(authRefreshHandlers).toHaveLength(1);
		authRefreshHandlers[0]?.();

		expect(socket.io.opts.auth.token).toBe('fresh-access-token');
		expect(socket.io.opts.auth.client_type).toBe('web_client');
		expect(disconnect).not.toHaveBeenCalled();
		expect(connect).not.toHaveBeenCalled();
		unsub();
	});
});
