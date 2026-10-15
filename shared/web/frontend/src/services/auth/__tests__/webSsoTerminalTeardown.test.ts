/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Continuity W3 locks: network keep-session vs terminal session-ended pending.
 *
 * Related:
 * - `webSsoTerminalTeardown.ts`
 * - `documentation/platform/WEB-SSO-SESSION-CONTINUITY-PLAN.md` §W3
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	clearSessionEndedPending,
	hasSessionEndedPending,
	hasSessionReplacedPending,
} from '../../../utils/authRedirect';
import { handleBrowserTerminalRefreshFailure } from '../webSsoTerminalTeardown';

vi.mock('../webSsoRecoveryCapsule', () => ({
	flushWebSsoRecoveryCapsule: vi.fn(async () => ({
		preserved: true,
		expiresAt: '2099-01-01T00:00:00Z',
	})),
}));

describe('Continuity W3 terminal teardown', () => {
	afterEach(() => {
		clearSessionEndedPending();
		sessionStorage.clear();
		vi.clearAllMocks();
	});

	it('keeps session on network refresh failure', async () => {
		const clearSession = vi.fn();
		const result = await handleBrowserTerminalRefreshFailure({
			error: new TypeError('Failed to fetch'),
			clearSession,
		});
		expect(result.action).toBe('kept');
		expect(result.kind).toBe('network');
		expect(clearSession).not.toHaveBeenCalled();
		expect(hasSessionEndedPending()).toBe(false);
	});

	it('marks session-ended for Session not active (not session_replaced)', async () => {
		const clearSession = vi.fn();
		const result = await handleBrowserTerminalRefreshFailure({
			error: {
				error: 'invalid_grant',
				error_description: 'Session not active',
			},
			clearSession,
		});
		expect(result.action).toBe('session_ended');
		expect(result.kind).toBe('idle_or_max_expired');
		expect(result.preserved).toBe(true);
		expect(clearSession).toHaveBeenCalledTimes(1);
		expect(hasSessionEndedPending()).toBe(true);
		expect(hasSessionReplacedPending()).toBe(false);
	});
});
