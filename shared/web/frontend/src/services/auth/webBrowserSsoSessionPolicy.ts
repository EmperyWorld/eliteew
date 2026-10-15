/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Declared browser SSO session policy for Continuity W0/W1 — values the SPA may
 * display or correlate without inferring timeouts from a failed refresh.
 *
 * Invariants:
 * - `declared_current` mirrors Keycloak harden defaults after Continuity W1
 *   (12h idle / 24h max; Remember Me 14d).
 * - `target_locked` matches WEB-SSO-SESSION-CONTINUITY-CONTRACT (same numbers).
 * - No secrets; timeouts only.
 *
 * Related:
 * - `documentation/platform/WEB-SSO-SESSION-CONTINUITY-CONTRACT.md`
 * - `docker/scripts/keycloak-harden-empery-realm.sh`
 * - `GET /api/v1/auth/sso/session-policy`
 */

export type WebBrowserSsoSessionPolicySource =
	| 'declared_current'
	| 'target_locked';

export interface WebBrowserSsoSessionPolicy {
	source: WebBrowserSsoSessionPolicySource;
	clientId: 'empery-web';
	accessTokenLifespanSec: number;
	ssoSessionIdleTimeoutSec: number;
	ssoSessionMaxLifespanSec: number;
	ssoSessionIdleTimeoutRememberMeSec: number;
	ssoSessionMaxLifespanRememberMeSec: number;
	revokeRefreshToken: true;
	refreshTokenMaxReuse: 0;
}

const CONTINUITY_W1_POLICY_NUMBERS = {
	accessTokenLifespanSec: 900,
	ssoSessionIdleTimeoutSec: 43_200,
	ssoSessionMaxLifespanSec: 86_400,
	ssoSessionIdleTimeoutRememberMeSec: 1_209_600,
	ssoSessionMaxLifespanRememberMeSec: 1_209_600,
	revokeRefreshToken: true as const,
	refreshTokenMaxReuse: 0 as const,
};

/** Declared after Continuity W1 harden defaults (must match live after ops apply). */
export const WEB_BROWSER_SSO_SESSION_POLICY_CURRENT: WebBrowserSsoSessionPolicy =
	{
		source: 'declared_current',
		clientId: 'empery-web',
		...CONTINUITY_W1_POLICY_NUMBERS,
	};

/** Locked Continuity contract target (identical to W1 declared current). */
export const WEB_BROWSER_SSO_SESSION_POLICY_TARGET: WebBrowserSsoSessionPolicy =
	{
		source: 'target_locked',
		clientId: 'empery-web',
		...CONTINUITY_W1_POLICY_NUMBERS,
	};

export function getDeclaredWebBrowserSsoSessionPolicy(): WebBrowserSsoSessionPolicy {
	return WEB_BROWSER_SSO_SESSION_POLICY_CURRENT;
}
