/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract locks for Continuity W0 refresh-result classification.
 *
 * Invariants:
 * - Session not active ≠ network; reuse patterns ≠ idle/max.
 *
 * Related:
 * - `webSsoRefreshResult.ts`
 * - `documentation/platform/WEB-SSO-SESSION-CONTINUITY-PLAN.md` §W0
 */

import { describe, expect, it } from 'vitest';
import {
	buildWebSsoRefreshFailureEvent,
	buildWebSsoRefreshSuccessEvent,
	classifyWebSsoRefreshFailure,
	newWebSsoRefreshCorrelationId,
} from '../webSsoRefreshResult';
import {
	WEB_BROWSER_SSO_SESSION_POLICY_CURRENT,
	WEB_BROWSER_SSO_SESSION_POLICY_TARGET,
	getDeclaredWebBrowserSsoSessionPolicy,
} from '../webBrowserSsoSessionPolicy';

describe('classifyWebSsoRefreshFailure', () => {
	it('maps Keycloak Session not active to idle_or_max_expired', () => {
		const err = Object.assign(new Error('OAuth response body error'), {
			error: 'invalid_grant',
			error_description: 'Session not active',
			status: 400,
		});
		const result = classifyWebSsoRefreshFailure({ error: err });
		expect(result.kind).toBe('idle_or_max_expired');
		expect(result.oauthError).toBe('invalid_grant');
		expect(result.oauthErrorDescription).toBe('Session not active');
		expect(result.httpStatus).toBe(400);
	});

	it('maps refresh token reuse to reuse_detected', () => {
		const err = Object.assign(new Error('OAuth response body error'), {
			error: 'invalid_grant',
			error_description: 'Maximum allowed refresh token reuse exceeded',
			status: 400,
		});
		expect(classifyWebSsoRefreshFailure({ error: err }).kind).toBe(
			'reuse_detected'
		);
	});

	it('maps Token is not active to reuse_detected', () => {
		const err = Object.assign(new Error('OAuth response body error'), {
			error: 'invalid_grant',
			error_description: 'Token is not active',
			status: 400,
		});
		expect(classifyWebSsoRefreshFailure({ error: err }).kind).toBe(
			'reuse_detected'
		);
	});

	it('maps session_replaced wording distinctly', () => {
		const err = new Error('Session was replaced by a newer login');
		expect(classifyWebSsoRefreshFailure({ error: err }).kind).toBe(
			'session_replaced'
		);
	});

	it('maps Failed to fetch to network (not idle/max)', () => {
		const err = new TypeError('Failed to fetch');
		expect(classifyWebSsoRefreshFailure({ error: err }).kind).toBe('network');
	});

	it('maps 503 without OAuth body to network', () => {
		const err = new Error('HTTP 503');
		expect(
			classifyWebSsoRefreshFailure({ error: err, httpStatus: 503 }).kind
		).toBe('network');
	});
});

describe('webSsoRefresh continuity events', () => {
	it('builds success and failure events with shared correlation id', () => {
		const id = newWebSsoRefreshCorrelationId();
		expect(id.length).toBeGreaterThan(8);
		expect(buildWebSsoRefreshSuccessEvent(id)).toEqual({
			phase: 'result',
			correlationId: id,
			kind: 'refreshed',
		});
		const failure = buildWebSsoRefreshFailureEvent(id, {
			error: Object.assign(new Error('x'), {
				error: 'invalid_grant',
				error_description: 'Session not active',
				status: 400,
			}),
		});
		expect(failure.kind).toBe('idle_or_max_expired');
		expect(failure.correlationId).toBe(id);
		expect(JSON.stringify(failure)).not.toMatch(/Bearer |eyJ|refresh_token/i);
	});
});

describe('webBrowserSsoSessionPolicy', () => {
	it('exposes declared Continuity W1 values without inventing from failures', () => {
		const policy = getDeclaredWebBrowserSsoSessionPolicy();
		expect(policy).toEqual(WEB_BROWSER_SSO_SESSION_POLICY_CURRENT);
		expect(policy.ssoSessionIdleTimeoutSec).toBe(43_200);
		expect(policy.ssoSessionMaxLifespanSec).toBe(86_400);
		expect(policy.refreshTokenMaxReuse).toBe(0);
		expect(WEB_BROWSER_SSO_SESSION_POLICY_TARGET.ssoSessionIdleTimeoutSec).toBe(
			43_200
		);
		expect(WEB_BROWSER_SSO_SESSION_POLICY_TARGET.ssoSessionMaxLifespanSec).toBe(
			86_400
		);
	});
});
