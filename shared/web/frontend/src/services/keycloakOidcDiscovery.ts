/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * OIDC URL / discovery helpers for Keycloak realm `empery`: issuer resolution,
 * auth-proxy rewrite/restore, loopback discovery fetch, password-reset URL.
 *
 * Invariants:
 * - Issuer identity stays `https://auth.eliteew.ru` on kiosk; discovery HTTP may
 *   use same-origin `/auth-proxy/...` then restore public IdP URLs.
 * - FoFline `fofline-spa://` (opaque origin) never uses auth-proxy discovery or
 *   location.origin as SSO callback base — public app/IdP instead.
 * - FoFline/opaque: do **not** `fetch` Keycloak discovery (Keycloak omits ACAO for
 *   custom-scheme / `Origin: null` → WebKit «Load failed»); bake public endpoints.
 * - SSO callback URL does not upgrade to https on loopback.
 * - Browser login/logout assign uses public HTTPS (`resolvePublicBrowserAuthorizationUrl`).
 *
 * Related:
 * - `services/keycloak.ts` (public facade), `keycloakProfile.ts`,
 *   `documentation/product/FRONTEND-AUTH.md`,
 *   `documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md` §5,
 *   `documentation/platform/docker-re_doc/KEYCLOAK-ELITEEW.md`
 */

import * as oauth from 'oauth4webapi';
import {
	isFoflineLocalSpaLocation,
	isOpaqueBrowserLocationOrigin,
	normalizeRedirectUri,
} from '../utils/redirectUriNormalize';
import { getProfileKeycloakClientId } from './keycloakProfile';

const KEYCLOAK_REALM = 'empery';
const PUBLIC_KEYCLOAK_ORIGIN = 'https://auth.eliteew.ru';
const PUBLIC_APP_ORIGIN = 'https://app.eliteew.ru';

export function getKeycloakClientId(): string {
	return getProfileKeycloakClientId();
}

export function getKeycloakUrl(): string {
	const explicit = import.meta.env.VITE_KEYCLOAK_URL;
	if (typeof explicit === 'string' && explicit.trim()) {
		return explicit.trim().replace(/\/+$/, '');
	}
	// Always public IdP identity (iss=/callback validation). Loopback discovery
	// uses same-origin /auth-proxy fetch in getAuthorizationServer — not this URL.
	return 'https://auth.eliteew.ru';
}

/**
 * SSO code exchange URL for `POST /api/v1/auth/sso/callback`.
 * Loopback http (kiosk / local nginx) must stay http — upgrading to https://127.0.0.1
 * breaks same-origin callback when TLS is not on the kiosk listener.
 */
export function resolveBackendSsoCallbackUrl(
	rawBase: string,
	path = '/api/v1/auth/sso/callback'
): string {
	let hostname = '';
	try {
		hostname = new URL(rawBase).hostname;
	} catch {
		/* keep empty — fall through to https upgrade for non-URL bases */
	}
	const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1';
	const base =
		rawBase.startsWith('http://') && !isLoopback
			? rawBase.replace('http://', 'https://')
			: rawBase;
	return new URL(path, base.endsWith('/') ? base : `${base}/`).toString();
}

export function getBackendSsoCallbackUrl(): string {
	const path = '/api/v1/auth/sso/callback';
	if (typeof window === 'undefined') return path;
	const envBase =
		(typeof import.meta.env.VITE_API_BASE_URL === 'string' &&
			import.meta.env.VITE_API_BASE_URL.trim()) ||
		(typeof import.meta.env.VITE_API_URL === 'string' &&
			import.meta.env.VITE_API_URL.trim()) ||
		'';
	// FoFline local pack / opaque origin cannot host /api — use env or public app.
	const rawBase =
		envBase ||
		(isOpaqueBrowserLocationOrigin() || isFoflineLocalSpaLocation()
			? PUBLIC_APP_ORIGIN
			: window.location.origin);
	return resolveBackendSsoCallbackUrl(rawBase, path);
}

export function getIssuerUrl(): URL {
	const base = getKeycloakUrl().replace(/\/+$/, '');
	if (base.includes('/realms/')) {
		return new URL(base);
	}
	return new URL(`${base}/realms/${KEYCLOAK_REALM}`);
}

/** Keycloak reset-credentials action (email link flow). */
export function buildKeycloakPasswordResetUrl(options?: {
	redirectUri?: string;
}): string {
	const issuer = resolvePublicBrowserAuthorizationUrl(getIssuerUrl().href);
	const url = new URL(
		`${issuer.origin}${issuer.pathname}/login-actions/reset-credentials`
	);
	url.searchParams.set('client_id', getKeycloakClientId());
	const redirectUri = options?.redirectUri?.trim();
	if (redirectUri) {
		url.searchParams.set('redirect_uri', normalizeRedirectUri(redirectUri));
	}
	return url.toString();
}

export function shouldAllowInsecureOidcRequests(): boolean {
	try {
		const issuer = getIssuerUrl();
		return (
			issuer.protocol === 'http:' &&
			(issuer.hostname === 'localhost' || issuer.hostname === '127.0.0.1')
		);
	} catch {
		return false;
	}
}

/**
 * When `VITE_KEYCLOAK_URL` is `{origin}/auth-proxy`, discovery may still advertise
 * `https://auth.eliteew.ru`. Rewrite onto the auth-proxy base before
 * `processDiscoveryResponse`. Prefer kiosk default (public issuer + proxy fetch).
 */
export function rewriteAuthProxyDiscoveryDocument(
	expectedIssuer: URL,
	document: Record<string, unknown>,
	authProxyBase: string
): Record<string, unknown> {
	const publicOrigin = 'https://auth.eliteew.ru';
	const proxyBase = authProxyBase.replace(/\/+$/, '');
	const expectedIssuerHref = expectedIssuer.href.replace(/\/+$/, '');
	const rewriteValue = (value: unknown): unknown => {
		if (typeof value !== 'string') return value;
		if (value.startsWith(publicOrigin)) {
			return `${proxyBase}${value.slice(publicOrigin.length)}`;
		}
		return value;
	};
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(document)) {
		out[key] = rewriteValue(value);
	}
	out.issuer = expectedIssuerHref;
	return out;
}

/**
 * Undo nginx `sub_filter` (or accidental proxy rewrite) so discovery keeps the
 * public IdP issuer — required for oauth4webapi `iss` check on callback.
 */
export function restorePublicIdpDiscoveryDocument(
	expectedIssuer: URL,
	document: Record<string, unknown>,
	authProxyBase: string
): Record<string, unknown> {
	const publicOrigin = 'https://auth.eliteew.ru';
	const proxyBase = authProxyBase.replace(/\/+$/, '');
	const expectedIssuerHref = expectedIssuer.href.replace(/\/+$/, '');
	const rewriteValue = (value: unknown): unknown => {
		if (typeof value !== 'string') return value;
		if (value.startsWith(proxyBase)) {
			return `${publicOrigin}${value.slice(proxyBase.length)}`;
		}
		return value;
	};
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(document)) {
		out[key] = rewriteValue(value);
	}
	out.issuer = expectedIssuerHref;
	return out;
}

export function isLoopbackAuthProxyBase(base: string): boolean {
	try {
		const url = new URL(base);
		const path = url.pathname.replace(/\/+$/, '');
		return (
			(url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
			path.endsWith('/auth-proxy')
		);
	} catch {
		return false;
	}
}

/**
 * Browser must open the real HTTPS IdP. Navigating to `{origin}/auth-proxy/...`
 * over HTTP drops Secure cookies and breaks theme CSS.
 */
export function resolvePublicBrowserAuthorizationUrl(
	authorizationEndpoint: string
): URL {
	const url = new URL(authorizationEndpoint);
	const host = url.hostname;
	const isLoopback = host === 'localhost' || host === '127.0.0.1';
	const path = url.pathname;
	const authProxyPrefix = '/auth-proxy';
	if (isLoopback && path.startsWith(authProxyPrefix)) {
		const rest = path.slice(authProxyPrefix.length) || '/';
		const out = new URL(rest, `${PUBLIC_KEYCLOAK_ORIGIN}/`);
		out.search = url.search;
		out.hash = url.hash;
		return out;
	}
	if (isLoopback) {
		const out = new URL(path || '/', `${PUBLIC_KEYCLOAK_ORIGIN}/`);
		out.search = url.search;
		out.hash = url.hash;
		return out;
	}
	return url;
}

/** Same-origin discovery URL for kiosk (avoids CORS Failed to fetch). */
export function resolveLoopbackAuthProxyDiscoveryUrl(issuer: URL): URL | null {
	if (typeof window === 'undefined') return null;
	// FoFline L3: hostname is "localhost" but origin is opaque ("null") — no auth-proxy.
	if (
		isOpaqueBrowserLocationOrigin() ||
		isFoflineLocalSpaLocation() ||
		(window.location.protocol !== 'http:' &&
			window.location.protocol !== 'https:')
	) {
		return null;
	}
	const hostname = window.location.hostname;
	if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
		return null;
	}
	const realmPath = issuer.pathname.replace(/\/+$/, '');
	return new URL(
		`/auth-proxy${realmPath}/.well-known/openid-configuration`,
		window.location.origin
	);
}

export async function maybeRewriteDiscoveryResponseForAuthProxy(
	issuer: URL,
	response: Response
): Promise<Response> {
	const proxyBase = getKeycloakUrl();
	if (!isLoopbackAuthProxyBase(proxyBase)) {
		return response;
	}
	const payload = (await response.json()) as Record<string, unknown>;
	const rewritten = rewriteAuthProxyDiscoveryDocument(
		issuer,
		payload,
		proxyBase
	);
	return new Response(JSON.stringify(rewritten), {
		status: response.status,
		statusText: response.statusText,
		headers: { 'content-type': 'application/json' },
	});
}

/**
 * True when the SPA cannot CORS-fetch Keycloak discovery (custom scheme /
 * opaque `Origin: null`). Live probe: Keycloak returns ACAO for
 * `https://app.eliteew.ru` but not for `fofline-spa://localhost` / `null`.
 */
export function shouldBakePublicOidcDiscovery(): boolean {
	return isFoflineLocalSpaLocation() || isOpaqueBrowserLocationOrigin();
}

/** Minimal public realm discovery for known Keycloak issuer (no network). */
export function buildBakedPublicOidcDiscoveryDocument(
	issuer: URL
): Record<string, unknown> {
	const base = issuer.href.replace(/\/+$/, '');
	return {
		issuer: base,
		authorization_endpoint: `${base}/protocol/openid-connect/auth`,
		token_endpoint: `${base}/protocol/openid-connect/token`,
		end_session_endpoint: `${base}/protocol/openid-connect/logout`,
		jwks_uri: `${base}/protocol/openid-connect/certs`,
		userinfo_endpoint: `${base}/protocol/openid-connect/userinfo`,
		revocation_endpoint: `${base}/protocol/openid-connect/revoke`,
		introspection_endpoint: `${base}/protocol/openid-connect/token/introspect`,
		response_types_supported: ['code'],
		subject_types_supported: ['public'],
		id_token_signing_alg_values_supported: ['RS256'],
		code_challenge_methods_supported: ['S256'],
	};
}

export function getBackendSsoRefreshUrl(): string {
	return getBackendSsoCallbackUrl().replace(
		/\/api\/v1\/auth\/sso\/callback\/?$/,
		'/api/v1/auth/sso/refresh'
	);
}

export async function fetchAuthorizationServerDiscovery(
	issuer: URL
): Promise<Response> {
	if (shouldBakePublicOidcDiscovery()) {
		return new Response(
			JSON.stringify(buildBakedPublicOidcDiscoveryDocument(issuer)),
			{
				status: 200,
				headers: { 'content-type': 'application/json' },
			}
		);
	}
	const loopbackDiscovery = resolveLoopbackAuthProxyDiscoveryUrl(issuer);
	if (loopbackDiscovery) {
		const response = await fetch(loopbackDiscovery.href, {
			headers: { accept: 'application/json' },
		});
		if (!response.ok) {
			throw new Error(
				`OIDC discovery via auth-proxy failed (${response.status})`
			);
		}
		const payload = (await response.json()) as Record<string, unknown>;
		const proxyBase = `${window.location.origin}/auth-proxy`;
		const restored = restorePublicIdpDiscoveryDocument(
			issuer,
			payload,
			proxyBase
		);
		return new Response(JSON.stringify(restored), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		});
	}
	const response = await oauth.discoveryRequest(issuer, getOidcHttpOptions());
	return maybeRewriteDiscoveryResponseForAuthProxy(issuer, response);
}

export function getOidcHttpOptions(): Record<PropertyKey, unknown> | undefined {
	if (!shouldAllowInsecureOidcRequests()) {
		return undefined;
	}
	return { [oauth.allowInsecureRequests]: true };
}
