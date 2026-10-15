/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Continuity W4 regression pack — pure contract locks for the Continuity
 * failure matrix (offline/network keep, dual flags, terminal vs replaced,
 * Remember Me honesty, declared policy). Not a live browser E2E harness.
 *
 * Related:
 * - `documentation/platform/WEB-SSO-SESSION-CONTINUITY-PLAN.md` §W4
 * - W0–W3 modules under `services/auth/`
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyWebSsoRefreshFailure } from '../webSsoRefreshResult';
import { evaluateSpaPersistenceCopyHonesty } from '../webSsoRememberMeHonesty';
import { handleBrowserTerminalRefreshFailure } from '../webSsoTerminalTeardown';
import {
	clearSessionEndedPending,
	clearSessionReplacedPending,
	hasSessionEndedPending,
	hasSessionReplacedPending,
	markSessionReplacedPending,
} from '../../../utils/authRedirect';
import { resolveTokenPersistence } from '../../keycloakTokenStorage';

vi.mock('../webSsoRecoveryCapsule', () => ({
	flushWebSsoRecoveryCapsule: vi.fn(async () => ({
		preserved: true,
		expiresAt: '2099-01-01T00:00:00Z',
	})),
}));

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../../../../../');

describe('Continuity W4 regression matrix', () => {
	afterEach(() => {
		clearSessionEndedPending();
		clearSessionReplacedPending();
		sessionStorage.clear();
		vi.clearAllMocks();
	});

	it('offline/network: keeps session and does not mark ended/replaced', async () => {
		const clearSession = vi.fn();
		const result = await handleBrowserTerminalRefreshFailure({
			error: new TypeError('NetworkError when attempting to fetch resource.'),
			clearSession,
		});
		expect(result.action).toBe('kept');
		expect(result.kind).toBe('network');
		expect(clearSession).not.toHaveBeenCalled();
		expect(hasSessionEndedPending()).toBe(false);
		expect(hasSessionReplacedPending()).toBe(false);
	});

	it('idle/max (Session not active): session-ended, not session_replaced', async () => {
		const clearSession = vi.fn();
		const classified = classifyWebSsoRefreshFailure({
			error: {
				error: 'invalid_grant',
				error_description: 'Session not active',
			},
		});
		expect(classified.kind).toBe('idle_or_max_expired');
		const result = await handleBrowserTerminalRefreshFailure({
			error: {
				error: 'invalid_grant',
				error_description: 'Session not active',
			},
			clearSession,
		});
		expect(result.action).toBe('session_ended');
		expect(hasSessionEndedPending()).toBe(true);
		expect(hasSessionReplacedPending()).toBe(false);
	});

	it('reuse_detected: terminal session-ended path', async () => {
		const result = await handleBrowserTerminalRefreshFailure({
			error: {
				error: 'invalid_grant',
				error_description: 'Maximum allowed refresh token reuse exceeded',
			},
			clearSession: vi.fn(),
		});
		expect(result.kind).toBe('reuse_detected');
		expect(result.action).toBe('session_ended');
		expect(hasSessionEndedPending()).toBe(true);
	});

	it('session_replaced classifier stays distinct from session-ended', async () => {
		const clearSession = vi.fn();
		const result = await handleBrowserTerminalRefreshFailure({
			error: {
				error: 'invalid_grant',
				error_description: 'Session was replaced by a newer login',
			},
			clearSession,
		});
		expect(result.action).toBe('session_replaced');
		expect(result.kind).toBe('session_replaced');
		expect(hasSessionReplacedPending()).toBe(true);
		expect(hasSessionEndedPending()).toBe(false);
		expect(clearSession).toHaveBeenCalledTimes(1);
	});

	it('dual flags: SPA persistence ≠ IdP Remember Me (honesty + storage)', () => {
		const en = JSON.parse(
			readFileSync(
				join(
					repoRoot,
					'shared/web/frontend/src/i18n/locales/en/desktopUi.json'
				),
				'utf8'
			)
		) as { loginFallback: { rememberMe: string; rememberMeHint: string } };
		expect(
			evaluateSpaPersistenceCopyHonesty({
				label: en.loginFallback.rememberMe,
				hint: en.loginFallback.rememberMeHint,
			})
		).toEqual({ ok: true });
		expect(resolveTokenPersistence(false)).toBe('session');
		expect(resolveTokenPersistence(true)).toBe('local');
	});

	it('declared policy still advertises W1 timeouts', () => {
		const policySrc = readFileSync(
			join(
				repoRoot,
				'shared/web/frontend/src/services/auth/webBrowserSsoSessionPolicy.ts'
			),
			'utf8'
		);
		expect(policySrc).toMatch(/43[_]?200/);
		expect(policySrc).toMatch(/86[_]?400/);
		expect(policySrc).toMatch(/1[_]?209[_]?600/);
	});

	it('manual session_replaced pending remains orthogonal to session-ended', () => {
		markSessionReplacedPending();
		expect(hasSessionReplacedPending()).toBe(true);
		expect(hasSessionEndedPending()).toBe(false);
	});
});
