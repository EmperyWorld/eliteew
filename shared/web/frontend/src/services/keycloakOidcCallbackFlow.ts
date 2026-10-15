/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * OIDC authorization-code callback + backend SSO exchange for AuthOidcFacade.
 *
 * Invariants:
 * - Code exchange goes through POST /api/v1/auth/sso/callback (registry sid).
 * - Does not import `keycloak.ts` barrel.
 *
 * Related:
 * - `keycloakOidcSessionShared.ts`, `keycloakAuthOidcFacade.ts`,
 *   `documentation/product/FRONTEND-AUTH.md`
 */

import * as oauth from 'oauth4webapi';
import {
	getBackendSsoCallbackUrl,
	getKeycloakClientId,
} from './keycloakOidcDiscovery';
import {
	clearAuthorizationResponseFromUrl,
	clearOidcAuthorizationState,
	readOidcAuthorizationState,
} from './keycloakPkceState';
import { resolveTokenPersistence } from './keycloakTokenStorage';
import {
	decodeJwtPayload,
	normalizeSsoCallbackErrorBody,
	oidcClient,
	type AuthOidcSessionHost,
	type SsoCallbackResponse,
} from './keycloakOidcSessionShared';

export async function oidcExchangeAuthorizationCodeViaBackend(
	_host: AuthOidcSessionHost,
	input: {
		code: string;
		state: string | null;
		redirectUri: string;
		codeVerifier: string;
	},
	replaceConfirmed = false
): Promise<SsoCallbackResponse> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};
	const {
		hasActiveSessionReplaceConfirmation,
		SESSION_REPLACE_CONFIRM_HEADER,
	} = await import('./auth/ssoSessionReplaceConfirm');
	if (replaceConfirmed || hasActiveSessionReplaceConfirmation()) {
		headers[SESSION_REPLACE_CONFIRM_HEADER] = '1';
	}

	const response = await fetch(getBackendSsoCallbackUrl(), {
		method: 'POST',
		credentials: 'include',
		headers,
		body: JSON.stringify({
			code: input.code,
			state: input.state,
			redirect_uri: input.redirectUri,
			code_verifier: input.codeVerifier,
			client_id: getKeycloakClientId(),
		}),
	});
	const payload: unknown = await response.json().catch(() => ({}));
	const authError = normalizeSsoCallbackErrorBody(payload);
	if (
		response.status === 409 &&
		authError.reason === 'session_replace_confirmation_required' &&
		!replaceConfirmed
	) {
		const { markSessionReplacedPending, resetInteractiveLoginGuard } =
			await import('../utils/authRedirect');
		markSessionReplacedPending();
		resetInteractiveLoginGuard();
		throw new Error(
			'Backend SSO callback requires explicit session replacement confirmation'
		);
	}
	if (!response.ok) {
		if (
			response.status === 503 &&
			authError.reason === 'sso_registry_unavailable'
		) {
			throw new Error(
				'SSO session registry temporarily unavailable — retry sign-in shortly (stack1 Postgres)'
			);
		}
		const detail =
			typeof authError.detail === 'string'
				? authError.detail
				: authError.reason || response.statusText || 'unknown error';
		throw new Error(
			`Backend SSO callback failed (${response.status}): ${detail}`
		);
	}
	return payload as SsoCallbackResponse;
}

export async function oidcHandleAuthorizationCallback(
	host: AuthOidcSessionHost,
	callbackParameters: URLSearchParams
): Promise<boolean> {
	const errorCode = callbackParameters.get('error');
	if (errorCode) {
		const description = callbackParameters.get('error_description');
		throw new Error(
			description ? `${errorCode}: ${description}` : `OIDC error: ${errorCode}`
		);
	}

	const tx = readOidcAuthorizationState();
	if (!tx) {
		throw new Error('Missing OIDC authorization state for callback');
	}

	host.tokenPersistence = resolveTokenPersistence(tx.persistSession);

	const as = await host.getAuthorizationServer();
	oauth.validateAuthResponse(as, oidcClient, callbackParameters, tx.state);
	const code = callbackParameters.get('code');
	if (!code) {
		throw new Error('OIDC callback does not include authorization code');
	}
	const result = await host.exchangeAuthorizationCodeViaBackend({
		code,
		state: callbackParameters.get('state'),
		redirectUri: tx.redirectUri,
		codeVerifier: tx.codeVerifier,
	});
	const tokens = result.tokens;
	if (!tokens?.access_token || !tokens.refresh_token || !tokens.id_token) {
		throw new Error(
			'Backend SSO callback does not include refresh/access/id token'
		);
	}
	const idTokenClaims = decodeJwtPayload(tokens.id_token);
	if (idTokenClaims?.nonce !== tx.nonce) {
		throw new Error('OIDC ID token nonce mismatch');
	}

	host.applyTokens({
		accessToken: tokens.access_token,
		refreshToken: tokens.refresh_token,
		idToken: tokens.id_token,
		expiresIn: tokens.expires_in,
	});
	host.persistCurrentTokens();
	clearOidcAuthorizationState();
	clearAuthorizationResponseFromUrl();
	void import('../utils/authRedirect').then(
		({
			clearAuthCallbackFailed,
			clearAuthAutoLoginAttempted,
			clearExplicitLogoutPending,
			clearSessionReplacedPending,
		}) => {
			clearAuthCallbackFailed();
			clearAuthAutoLoginAttempted();
			clearExplicitLogoutPending();
			clearSessionReplacedPending();
		}
	);
	host.invoke(host.onAuthSuccess);
	const { flushDeferredStaleBundleReload } = await import(
		'../utils/staleBundleReload'
	);
	flushDeferredStaleBundleReload();
	return true;
}
