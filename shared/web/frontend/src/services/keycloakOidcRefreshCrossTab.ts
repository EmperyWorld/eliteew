/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Cross-tab coordination for OIDC refresh_token grants under Keycloak
 * `revokeRefreshToken=true` / `refreshTokenMaxReuse=0`.
 *
 * Invariants:
 * - At most one browser profile grant at a time (`navigator.locks` when present).
 * - After the lock is acquired, callers must re-read persisted tokens before
 *   granting — another tab may already have rotated the refresh token.
 * - Does not import `keycloak.ts` / AuthOidcFacade (no cycle).
 *
 * Related:
 * - `keycloakOidcRefreshFlow.ts`, `keycloakTokenStorage.ts`,
 *   `documentation/product/FRONTEND-AUTH.md`
 */

import { accessTokenStillValid } from './keycloakEmbeddedOidc';
import { decodeJwtPayload } from './keycloakOidcSessionShared';
import {
	type PersistedKeycloakTokens,
	readPersistedKeycloakTokens,
} from './keycloakTokenStorage';

/** Web Lock name shared by all same-origin SPA tabs/windows. */
export const OIDC_REFRESH_WEB_LOCK_NAME = 'eliteew-oidc-refresh-v1';

/** Access-token remaining life (seconds) that skips an eager bootstrap refresh. */
export const OIDC_BOOTSTRAP_SKIP_REFRESH_MIN_VALIDITY_SEC = 70;

/**
 * Eager `refreshAccessToken` on cold init is only required when the access
 * token is missing/near expiry. Always rotating on every load races other
 * tabs under `refreshTokenMaxReuse=0` and kills the session family.
 */
export function shouldEagerRefreshStoredSession(
	tokenParsed: { exp?: number } | undefined,
	minValiditySec = OIDC_BOOTSTRAP_SKIP_REFRESH_MIN_VALIDITY_SEC
): boolean {
	return !accessTokenStillValid(tokenParsed, minValiditySec);
}

export async function withOidcRefreshWebLock<T>(
	run: () => Promise<T>
): Promise<T> {
	const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
	if (typeof locks?.request !== 'function') {
		return run();
	}
	return locks.request(OIDC_REFRESH_WEB_LOCK_NAME, () => run());
}

/**
 * After acquiring the cross-tab lock, adopt a newer persisted token island
 * (another tab may have completed refresh) and decide whether a grant is still
 * needed.
 */
export function adoptNewerPersistedTokensIfAny(input: {
	hostRefreshToken: string | undefined;
	hostTokenParsed: { exp?: number } | undefined;
	minValiditySec?: number;
}): {
	adopted: PersistedKeycloakTokens | null;
	grantStillNeeded: boolean;
} {
	const minValiditySec =
		input.minValiditySec ?? OIDC_BOOTSTRAP_SKIP_REFRESH_MIN_VALIDITY_SEC;
	const stored = readPersistedKeycloakTokens();
	const hostRt = input.hostRefreshToken ?? '';
	const adopted =
		stored?.refreshToken && stored.refreshToken !== hostRt ? stored : null;
	const effectiveRt = adopted?.refreshToken ?? input.hostRefreshToken;
	const effectiveParsed = adopted
		? (decodeJwtPayload(adopted.token) ?? undefined)
		: input.hostTokenParsed;
	if (!effectiveRt) {
		return { adopted, grantStillNeeded: false };
	}
	if (accessTokenStillValid(effectiveParsed, minValiditySec)) {
		return { adopted, grantStillNeeded: false };
	}
	return { adopted, grantStillNeeded: true };
}
