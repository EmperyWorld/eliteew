/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract locks for cross-tab OIDC refresh hygiene under maxReuse=0.
 *
 * Invariants:
 * - Fresh access token → no eager bootstrap refresh.
 * - Newer persisted RT after lock → adopt, skip grant when AT still valid.
 *
 * Related:
 * - `keycloakOidcRefreshCrossTab.ts`, `documentation/product/FRONTEND-AUTH.md`
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
	adoptNewerPersistedTokensIfAny,
	shouldEagerRefreshStoredSession,
} from '../keycloakOidcRefreshCrossTab';
import {
	KEYCLOAK_TOKEN_STORAGE_KEY,
	persistKeycloakTokens,
} from '../keycloakTokenStorage';

function jwtWithExp(expEpochSec: number): string {
	const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
	const payload = btoa(JSON.stringify({ exp: expEpochSec, sub: 'poet' }));
	return `${header}.${payload}.sig`;
}

describe('shouldEagerRefreshStoredSession', () => {
	it('skips eager refresh when access token has >70s left', () => {
		const exp = Math.floor(Date.now() / 1000) + 600;
		expect(shouldEagerRefreshStoredSession({ exp })).toBe(false);
	});

	it('requires eager refresh when access token is near expiry', () => {
		const exp = Math.floor(Date.now() / 1000) + 30;
		expect(shouldEagerRefreshStoredSession({ exp })).toBe(true);
	});

	it('requires eager refresh when exp is missing', () => {
		expect(shouldEagerRefreshStoredSession(undefined)).toBe(true);
	});
});

describe('adoptNewerPersistedTokensIfAny', () => {
	beforeEach(() => {
		sessionStorage.clear();
		localStorage.clear();
	});

	it('skips grant when host AT is still valid and storage matches', () => {
		const exp = Math.floor(Date.now() / 1000) + 600;
		const result = adoptNewerPersistedTokensIfAny({
			hostRefreshToken: 'rt-host',
			hostTokenParsed: { exp },
		});
		expect(result.adopted).toBeNull();
		expect(result.grantStillNeeded).toBe(false);
	});

	it('adopts newer persisted RT and skips grant when that AT is fresh', () => {
		const exp = Math.floor(Date.now() / 1000) + 600;
		const freshAt = jwtWithExp(exp);
		persistKeycloakTokens(
			{
				token: freshAt,
				refreshToken: 'rt-from-other-tab',
				savedAt: Date.now(),
			},
			'session'
		);
		expect(sessionStorage.getItem(KEYCLOAK_TOKEN_STORAGE_KEY)).toBeTruthy();

		const result = adoptNewerPersistedTokensIfAny({
			hostRefreshToken: 'rt-stale-in-memory',
			hostTokenParsed: { exp: Math.floor(Date.now() / 1000) + 10 },
		});
		expect(result.adopted?.refreshToken).toBe('rt-from-other-tab');
		expect(result.grantStillNeeded).toBe(false);
	});

	it('still needs grant when adopted island AT is near expiry', () => {
		const exp = Math.floor(Date.now() / 1000) + 20;
		persistKeycloakTokens(
			{
				token: jwtWithExp(exp),
				refreshToken: 'rt-from-other-tab',
				savedAt: Date.now(),
			},
			'session'
		);

		const result = adoptNewerPersistedTokensIfAny({
			hostRefreshToken: 'rt-stale-in-memory',
			hostTokenParsed: { exp: Math.floor(Date.now() / 1000) + 5 },
		});
		expect(result.adopted?.refreshToken).toBe('rt-from-other-tab');
		expect(result.grantStillNeeded).toBe(true);
	});
});
