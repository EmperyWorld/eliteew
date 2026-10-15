/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * OIDC logout (local clear + optional Keycloak end_session redirect).
 *
 * Invariants:
 * - Always clears local session first; embedded mobile and desktop/FoFline product
 *   WebViews skip IdP redirect (desktop host closes the product window).
 * - Browser `web` profile still uses Keycloak end_session.
 * - Does not import `keycloak.ts` barrel.
 *
 * Related:
 * - `keycloakOidcSessionShared.ts`, `keycloakAuthOidcFacade.ts`,
 *   `documentation/product/FRONTEND-AUTH.md`,
 *   `documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md`
 */

import { isEmbeddedEliteEWClient } from '../utils/eliteewEmbeddedClient';
import {
	normalizeRedirectUri,
	resolveDefaultOidcRedirectUri,
} from '../utils/redirectUriNormalize';
import { log } from '../utils/logger';
import { resolvePublicBrowserAuthorizationUrl } from './keycloakOidcDiscovery';
import { clearDesktopNativeOidcSessionViaBridge } from './keycloakDesktopNativeOidc';
import { getOidcRuntimeProfile } from './keycloakProfile';
import {
	KEYCLOAK_LOG,
	type AuthOidcSessionHost,
	type KeycloakLogoutOptions,
} from './keycloakOidcSessionShared';

function skipIdpLogoutRedirect(): boolean {
	if (isEmbeddedEliteEWClient()) {
		return true;
	}
	const profile = getOidcRuntimeProfile();
	return profile === 'desktopNative' || profile === 'foflineNative';
}

export async function oidcLogout(
	host: AuthOidcSessionHost,
	options?: KeycloakLogoutOptions
): Promise<void> {
	const redirectUri = normalizeRedirectUri(
		options?.redirectUri || resolveDefaultOidcRedirectUri()
	);
	const idTokenHint = host.idToken;
	await clearDesktopNativeOidcSessionViaBridge();
	host.clearSession(true, true);

	if (skipIdpLogoutRedirect()) {
		log.info(
			KEYCLOAK_LOG,
			isEmbeddedEliteEWClient()
				? 'Embedded Mobile EWA: session cleared locally without Keycloak redirect'
				: 'Desktop product WebView: session cleared locally; host closes the window (no Keycloak login redirect)'
		);
		return;
	}

	try {
		const as = await host.getAuthorizationServer();
		if (as.end_session_endpoint) {
			const logoutUrl = resolvePublicBrowserAuthorizationUrl(
				as.end_session_endpoint
			);
			if (idTokenHint) {
				logoutUrl.searchParams.set('id_token_hint', idTokenHint);
			}
			logoutUrl.searchParams.set('post_logout_redirect_uri', redirectUri);
			window.location.assign(logoutUrl.toString());
			return;
		}
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		log.warn(
			KEYCLOAK_LOG,
			`Logout endpoint discovery failed, fallback to local redirect: ${err.message}`
		);
	}

	window.location.assign(redirectUri);
}
