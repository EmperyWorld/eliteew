/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * OIDC interactive login/register redirect (PKCE start) for AuthOidcFacade.
 *
 * Invariants:
 * - Parallel login/register collapse via host.oidcInteractiveRedirectInFlight.
 * - FoFline (`foflineNative`) uses `response_mode=fragment` so authorization
 *   code/state never hit HTTPS access logs on the OIDC bridge.
 * - Desktop/FoFline native profiles recover through the host bridge and never
 *   bypass mandatory PAR with a browser PKCE redirect.
 * - Does not import `keycloak.ts` barrel.
 *
 * Related:
 * - `keycloakOidcSessionShared.ts`, `keycloakAuthOidcFacade.ts`,
 *   `public/fofline-oidc-bridge.html`,
 *   `documentation/product/FRONTEND-AUTH.md`
 */

import * as oauth from 'oauth4webapi';
import { isEmbeddedEliteEWClient } from '../utils/eliteewEmbeddedClient';
import {
	normalizeRedirectUri,
	resolveDefaultOidcRedirectUri,
} from '../utils/redirectUriNormalize';
import { log } from '../utils/logger';
import { hasDesktopNativeOidcBridge } from './keycloakDesktopNativeOidc';
import {
	getKeycloakClientId,
	resolvePublicBrowserAuthorizationUrl,
} from './keycloakOidcDiscovery';
import { getOidcRuntimeProfile } from './keycloakProfile';
import { writeOidcAuthorizationState } from './keycloakPkceState';
import { resolveTokenPersistence } from './keycloakTokenStorage';
import {
	KEYCLOAK_LOG,
	OIDC_SCOPES,
	type AuthOidcSessionHost,
	type KeycloakLoginOptions,
} from './keycloakOidcSessionShared';

export type OidcAuthorizationStartOutcome =
	| 'redirected'
	| 'skipped_native_session';

export async function oidcStartAuthorizationRequest(
	host: AuthOidcSessionHost,
	options: KeycloakLoginOptions | undefined,
	register: boolean
): Promise<OidcAuthorizationStartOutcome> {
	if (hasDesktopNativeOidcBridge()) {
		const hasSpaAccess = host.authenticated || Boolean(host.token?.trim());
		if (hasSpaAccess) {
			log.info(
				KEYCLOAK_LOG,
				'Skipping browser OIDC redirect; host native bridge owns the session'
			);
			return 'skipped_native_session';
		}
		try {
			const recovered = await host.refreshAccessToken();
			if (recovered && host.authenticated && host.token?.trim()) {
				log.info(
					KEYCLOAK_LOG,
					'Recovered SPA session through desktop native OIDC bridge'
				);
				host.invoke(host.onAuthSuccess);
				return 'skipped_native_session';
			}
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			log.warn(
				KEYCLOAK_LOG,
				`Desktop native OIDC bridge recovery failed: ${err.message}`
			);
		}
		throw new Error('Desktop native OIDC session could not be restored');
	}
	const runtimeProfile = getOidcRuntimeProfile();
	if (
		runtimeProfile === 'desktopNative' ||
		runtimeProfile === 'foflineNative'
	) {
		throw new Error('Desktop native OIDC bridge is unavailable');
	}
	const redirectUri = normalizeRedirectUri(
		options?.redirectUri || resolveDefaultOidcRedirectUri()
	);
	const state = oauth.generateRandomState();
	const nonce = oauth.generateRandomNonce();
	const codeVerifier = oauth.generateRandomCodeVerifier();
	const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);

	const persistSessionOption = options?.persistSession;

	host.tokenPersistence =
		persistSessionOption !== undefined
			? resolveTokenPersistence(persistSessionOption)
			: resolveTokenPersistence();

	// Persist PKCE state before discovery/network so parallel session_replaced
	// handlers cannot wipe it between write and navigation.assign.
	writeOidcAuthorizationState({
		state,
		nonce,
		codeVerifier,
		redirectUri,
		register,
		savedAt: Date.now(),
		persistSession: persistSessionOption,
	});

	const as = await host.getAuthorizationServer();
	if (!as.authorization_endpoint) {
		throw new Error('OIDC authorization_endpoint is missing in discovery');
	}

	const authorizationUrl = resolvePublicBrowserAuthorizationUrl(
		as.authorization_endpoint
	);
	authorizationUrl.searchParams.set('client_id', getKeycloakClientId());
	authorizationUrl.searchParams.set('response_type', 'code');
	authorizationUrl.searchParams.set('scope', OIDC_SCOPES);
	authorizationUrl.searchParams.set('redirect_uri', redirectUri);
	authorizationUrl.searchParams.set('state', state);
	authorizationUrl.searchParams.set('nonce', nonce);
	authorizationUrl.searchParams.set('code_challenge', codeChallenge);
	authorizationUrl.searchParams.set('code_challenge_method', 'S256');
	// FoFline HTTPS bridge: keep OAuth credentials out of nginx $request query logs.
	if (getOidcRuntimeProfile() === 'foflineNative') {
		authorizationUrl.searchParams.set('response_mode', 'fragment');
	}
	if (options?.forceFreshAuth) {
		authorizationUrl.searchParams.set('prompt', 'login');
		authorizationUrl.searchParams.set('max_age', '0');
	}
	if (register) {
		authorizationUrl.searchParams.set('kc_action', 'register');
	}

	window.location.assign(authorizationUrl.toString());
	return 'redirected';
}

async function clearInteractiveLoginGuards(
	host: AuthOidcSessionHost
): Promise<void> {
	host.oidcInteractiveRedirectInFlight = false;
	const { resetInteractiveLoginGuard } = await import('../utils/authRedirect');
	resetInteractiveLoginGuard();
}

export async function oidcLogin(
	host: AuthOidcSessionHost,
	options?: KeycloakLoginOptions
): Promise<void> {
	if (isEmbeddedEliteEWClient()) {
		log.warn(
			KEYCLOAK_LOG,
			'Skipping browser OIDC login in embedded Mobile EWA WebView'
		);
		return;
	}
	if (host.oidcInteractiveRedirectInFlight) {
		return;
	}
	host.oidcInteractiveRedirectInFlight = true;
	try {
		const outcome = await oidcStartAuthorizationRequest(host, options, false);
		if (outcome === 'skipped_native_session') {
			await clearInteractiveLoginGuards(host);
		}
	} catch (error) {
		await clearInteractiveLoginGuards(host);
		const err = error instanceof Error ? error : new Error(String(error));
		log.error(KEYCLOAK_LOG, 'OIDC login redirect failed', err);
		host.invoke(host.onAuthError, err);
		if (typeof window !== 'undefined') {
			window.alert(
				`Не удалось открыть вход (OIDC): ${err.message}\nПроверьте доступ к https://auth.eliteew.ru (portal WG) и консоль.`
			);
		}
	}
}

export async function oidcRegister(
	host: AuthOidcSessionHost,
	options?: KeycloakLoginOptions
): Promise<void> {
	if (isEmbeddedEliteEWClient()) {
		log.warn(
			KEYCLOAK_LOG,
			'Skipping browser OIDC register in embedded Mobile EWA WebView'
		);
		return;
	}
	if (host.oidcInteractiveRedirectInFlight) {
		return;
	}
	host.oidcInteractiveRedirectInFlight = true;
	try {
		const outcome = await oidcStartAuthorizationRequest(host, options, true);
		if (outcome === 'skipped_native_session') {
			await clearInteractiveLoginGuards(host);
		}
	} catch (error) {
		await clearInteractiveLoginGuards(host);
		const err = error instanceof Error ? error : new Error(String(error));
		log.error(KEYCLOAK_LOG, 'OIDC register redirect failed', err);
		host.invoke(host.onAuthError, err);
	}
}
