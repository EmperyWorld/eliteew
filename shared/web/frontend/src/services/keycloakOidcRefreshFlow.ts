/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * OIDC access-token refresh + embedded recover for AuthOidcFacade.
 *
 * Invariants:
 * - Single in-flight refresh via host.refreshInFlight (sync lock before any await).
 * - Cross-tab: `navigator.locks` + re-read persisted RT after lock (maxReuse=0).
 * - Mobile-embedded prefers native bridge refresh.
 * - Browser refresh emits Continuity W0 redacted start/result events (no tokens).
 * - Does not import `keycloak.ts` barrel.
 *
 * Related:
 * - `keycloakOidcSessionShared.ts`, `keycloakAuthOidcFacade.ts`,
 *   `keycloakEmbeddedOidc.ts`, `auth/webSsoRefreshResult.ts`,
 *   `documentation/product/FRONTEND-AUTH.md`,
 *   `documentation/platform/WEB-SSO-SESSION-CONTINUITY-PLAN.md` §W0
 */

import * as oauth from 'oauth4webapi';
import { log } from '../utils/logger';
import { isAuthSessionLocked } from './auth/authSessionLock';
import { emitWebSsoRefreshContinuityEvent } from './auth/webSsoRefreshContinuityLog';
import {
	buildWebSsoRefreshFailureEvent,
	buildWebSsoRefreshStartEvent,
	buildWebSsoRefreshSuccessEvent,
	newWebSsoRefreshCorrelationId,
} from './auth/webSsoRefreshResult';
import {
	getBackendSsoRefreshUrl,
	getOidcHttpOptions,
	shouldBakePublicOidcDiscovery,
} from './keycloakOidcDiscovery';
import {
	accessTokenStillValid,
	hydrateMobileEmbeddedTokensFromNativeBridge as hydrateEmbeddedTokensFromNativeBridge,
	isMobileEmbeddedOidcContext,
	refreshAccessTokenViaNativeBridge,
} from './keycloakEmbeddedOidc';
import {
	hasDesktopNativeOidcBridge,
	refreshAccessTokenViaDesktopNativeBridge,
} from './keycloakDesktopNativeOidc';
import { readPersistedKeycloakTokens } from './keycloakTokenStorage';
import {
	adoptNewerPersistedTokensIfAny,
	withOidcRefreshWebLock,
} from './keycloakOidcRefreshCrossTab';
import {
	KEYCLOAK_LOG,
	notifyAuthRefreshSuccessSubscribers,
	oidcClient,
	type AuthOidcSessionHost,
} from './keycloakOidcSessionShared';

function shouldEmitBrowserRefreshContinuity(): boolean {
	return (
		!isMobileEmbeddedOidcContext() &&
		!hasDesktopNativeOidcBridge() &&
		!shouldBakePublicOidcDiscovery()
	);
}

function emitBrowserRefreshStart(): string | null {
	if (!shouldEmitBrowserRefreshContinuity()) {
		return null;
	}
	const correlationId = newWebSsoRefreshCorrelationId();
	emitWebSsoRefreshContinuityEvent(buildWebSsoRefreshStartEvent(correlationId));
	return correlationId;
}

function emitBrowserRefreshSuccess(correlationId: string | null): void {
	if (!correlationId) return;
	emitWebSsoRefreshContinuityEvent(
		buildWebSsoRefreshSuccessEvent(correlationId)
	);
}

function emitBrowserRefreshFailure(
	correlationId: string | null,
	error: unknown
): void {
	if (!correlationId) return;
	emitWebSsoRefreshContinuityEvent(
		buildWebSsoRefreshFailureEvent(correlationId, { error })
	);
}
/** FoFline local pack: Keycloak token endpoint has no ACAO for custom-scheme Origin. */
async function refreshAccessTokenViaBackendSso(
	host: AuthOidcSessionHost
): Promise<{
	accessToken: string;
	refreshToken: string;
	expiresIn?: number;
}> {
	const refreshToken = host.refreshToken;
	if (!refreshToken) {
		throw new Error('No refresh token available');
	}
	const url = new URL(getBackendSsoRefreshUrl());
	url.searchParams.set('refresh_token', refreshToken);
	const response = await fetch(url.toString(), {
		method: 'POST',
		credentials: 'include',
		headers: { accept: 'application/json' },
	});
	if (!response.ok) {
		throw new Error(`SSO refresh failed (${response.status})`);
	}
	const body = (await response.json()) as {
		access_token?: string;
		refresh_token?: string;
		expires_in?: number;
	};
	if (!body.access_token) {
		throw new Error('SSO refresh response missing access_token');
	}
	return {
		accessToken: body.access_token,
		refreshToken: body.refresh_token ?? refreshToken,
		expiresIn: body.expires_in,
	};
}

export function oidcHandleEmbeddedRefreshFailure(
	host: AuthOidcSessionHost,
	error: unknown
): boolean {
	if (!isMobileEmbeddedOidcContext()) {
		throw error instanceof Error ? error : new Error(String(error));
	}
	const err = error instanceof Error ? error : new Error(String(error));
	if (host.token && host.refreshToken) {
		log.warn(
			KEYCLOAK_LOG,
			`Embedded updateToken refresh failed (${err.message}); keeping session`
		);
		return false;
	}
	throw err;
}

export async function oidcRefreshAccessToken(
	host: AuthOidcSessionHost
): Promise<boolean> {
	// Sync join + lock before any await — concurrent updateToken() used to race
	// (dynamic import gap / dual callers) and fire two refresh_token grants.
	if (host.refreshInFlight) {
		return host.refreshInFlight;
	}
	if (!host.refreshToken && !hasDesktopNativeOidcBridge()) {
		throw new Error('No refresh token available');
	}

	const previousToken = host.token;

	let settle!: (value: boolean | PromiseLike<boolean>) => void;
	let fail!: (reason?: unknown) => void;
	const flight = new Promise<boolean>((resolve, reject) => {
		settle = resolve;
		fail = reject;
	});
	host.refreshInFlight = flight;

	void (async (): Promise<void> => {
		let continuityId: string | null = null;
		try {
			const tokensChanged = await withOidcRefreshWebLock(async () => {
				if (hasDesktopNativeOidcBridge()) {
					const tokens = await refreshAccessTokenViaDesktopNativeBridge();
					host.applyTokens({
						accessToken: tokens.accessToken,
						idToken: tokens.idToken ?? host.idToken,
					});
					host.persistCurrentTokens();
					return previousToken !== host.token;
				}
				if (isMobileEmbeddedOidcContext()) {
					const tokens = refreshAccessTokenViaNativeBridge();
					host.applyTokens({
						accessToken: tokens.accessToken,
						refreshToken: tokens.refreshToken,
						idToken: host.idToken,
					});
					host.persistCurrentTokens();
					return previousToken !== host.token;
				}

				const adopted = adoptNewerPersistedTokensIfAny({
					hostRefreshToken: host.refreshToken,
					hostTokenParsed: host.tokenParsed,
				});
				if (adopted.adopted) {
					host.applyTokens({
						accessToken: adopted.adopted.token,
						refreshToken: adopted.adopted.refreshToken,
						idToken: adopted.adopted.idToken,
						timeSkew: adopted.adopted.timeSkew,
					});
					if (adopted.adopted.persistence) {
						host.tokenPersistence = adopted.adopted.persistence;
					}
				}
				if (!adopted.grantStillNeeded) {
					// Another tab already rotated, or AT still fresh — no grant.
					return previousToken !== host.token;
				}

				const refreshTokenSnapshot = host.refreshToken;
				if (!refreshTokenSnapshot) {
					throw new Error('No refresh token available');
				}

				continuityId = emitBrowserRefreshStart();

				if (shouldBakePublicOidcDiscovery()) {
					const tokens = await refreshAccessTokenViaBackendSso(host);
					host.applyTokens({
						accessToken: tokens.accessToken,
						refreshToken: tokens.refreshToken,
						idToken: host.idToken,
						expiresIn: tokens.expiresIn,
					});
					host.persistCurrentTokens();
					return previousToken !== host.token;
				}

				const as = await host.getAuthorizationServer();
				const response = await oauth.refreshTokenGrantRequest(
					as,
					oidcClient,
					oauth.None(),
					refreshTokenSnapshot,
					getOidcHttpOptions()
				);
				const tokenResponse = await oauth.processRefreshTokenResponse(
					as,
					oidcClient,
					response
				);
				if (!tokenResponse.access_token) {
					throw new Error('Refresh response does not include access token');
				}
				host.applyTokens({
					accessToken: tokenResponse.access_token,
					refreshToken: tokenResponse.refresh_token ?? refreshTokenSnapshot,
					idToken: tokenResponse.id_token ?? host.idToken,
					expiresIn: tokenResponse.expires_in,
				});
				host.persistCurrentTokens();
				return previousToken !== host.token;
			});

			if (tokensChanged) {
				host.invoke(host.onAuthRefreshSuccess);
				notifyAuthRefreshSuccessSubscribers();
				emitBrowserRefreshSuccess(continuityId);
			}
			settle(tokensChanged);
		} catch (error) {
			emitBrowserRefreshFailure(continuityId, error);
			host.invoke(host.onAuthRefreshError);
			fail(error);
		} finally {
			if (host.refreshInFlight === flight) {
				host.refreshInFlight = null;
			}
		}
	})();

	return flight;
}

export async function oidcUpdateToken(
	host: AuthOidcSessionHost,
	minValidity = 30
): Promise<boolean> {
	if (isAuthSessionLocked()) {
		return false;
	}
	if (!host.authenticated || !host.token) {
		return false;
	}
	if (!host.refreshToken && !hasDesktopNativeOidcBridge()) {
		return false;
	}
	const expiresAt = host.tokenParsed?.exp;
	if (!expiresAt) {
		try {
			return await host.refreshAccessToken();
		} catch (error) {
			return oidcHandleEmbeddedRefreshFailure(host, error);
		}
	}
	const now = Math.floor(Date.now() / 1000);
	// MAX_SAFE_INTEGER (socket recover) must not force a refresh when AT is still fresh —
	// forced refresh under reuse=0 races with axios/timer and kills the session family.
	const effectiveMin =
		minValidity > 3600 ? 70 : Math.max(0, Math.floor(minValidity));
	if (expiresAt - now > effectiveMin) {
		return false;
	}
	try {
		return await host.refreshAccessToken();
	} catch (error) {
		return oidcHandleEmbeddedRefreshFailure(host, error);
	}
}

/** Re-apply native bridge + persisted tokens without clearing embedded WebView session. */
export async function oidcRecoverEmbeddedSession(
	host: AuthOidcSessionHost
): Promise<boolean> {
	if (!isMobileEmbeddedOidcContext()) {
		return host.authenticated;
	}
	hydrateEmbeddedTokensFromNativeBridge();
	const storedTokens = readPersistedKeycloakTokens();
	if (!storedTokens?.refreshToken) {
		return host.authenticated;
	}
	host.tokenPersistence = storedTokens.persistence ?? 'local';
	if (!host.token || !host.refreshToken) {
		host.applyTokens({
			accessToken: storedTokens.token,
			refreshToken: storedTokens.refreshToken,
			idToken: storedTokens.idToken,
			timeSkew: storedTokens.timeSkew,
		});
	}
	try {
		await host.refreshAccessToken();
		host.invoke(host.onAuthSuccess);
		return true;
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		if (accessTokenStillValid(host.tokenParsed)) {
			log.warn(
				KEYCLOAK_LOG,
				`Embedded recover: refresh failed (${err.message}); keeping valid access token`
			);
			host.invoke(host.onAuthSuccess);
			return true;
		}
		if (storedTokens.token && storedTokens.refreshToken) {
			log.warn(
				KEYCLOAK_LOG,
				`Embedded recover: refresh failed (${err.message}); trusting bootstrap tokens`
			);
			host.applyTokens({
				accessToken: storedTokens.token,
				refreshToken: storedTokens.refreshToken,
				idToken: storedTokens.idToken,
				timeSkew: storedTokens.timeSkew,
			});
			host.invoke(host.onAuthSuccess);
			return true;
		}
		return false;
	}
}
