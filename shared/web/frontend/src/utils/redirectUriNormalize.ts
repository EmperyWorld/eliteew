/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Normalize OIDC redirect URIs without pulling authSession (avoids import cycles).
 * Rebuild FoFline local-pack redirect when the URL API reports opaque origin `"null"`.
 * Linux `fofline-spa:` uses the public HTTPS OIDC bridge (WebKitGTK blocks
 * custom-scheme redirects from HTTPS IdP).
 *
 * Invariants:
 * - Custom scheme `fofline-spa:` must never become `null/index.html` (opaque origin).
 * - Linux `fofline-spa:` default redirect is always `{APP_ORIGIN}/fofline-oidc-bridge.html`
 *   (Keycloak returns with `response_mode=fragment`; bridge JS reads hash then hands off).
 * - Windows `fofline-spa.localhost` keeps http(s) same-origin callback (no bridge).
 * - Hash is stripped; API origin is rewritten to app origin when configured.
 *
 * Related:
 * - `utils/authRedirect.ts`, `services/keycloakOidcLoginFlow.ts`
 * - `public/fofline-oidc-bridge.html`
 * - `documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md` §5
 */

const APP_ORIGIN = import.meta.env.VITE_APP_ORIGIN ?? 'https://app.eliteew.ru';
const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? 'https://api.eliteew.ru';

/** Exact public path Keycloak redirects to for Linux FoFline custom-scheme packs. */
export const FOFLINE_OIDC_BRIDGE_PATH = '/fofline-oidc-bridge.html';

/** True when Location.origin is unusable as an OIDC redirect base. */
export function isOpaqueBrowserLocationOrigin(
	origin: string | null | undefined = typeof window !== 'undefined'
		? window.location.origin
		: undefined
): boolean {
	return origin == null || origin === '' || origin === 'null';
}

/**
 * Whether the current document is FoFline L3 local SPA (custom protocol or
 * Windows WebView2 host). Hostname-only `localhost` under http(s) stays kiosk.
 */
export function isFoflineLocalSpaLocation(
	loc:
		| Pick<Location, 'protocol' | 'hostname'>
		| null
		| undefined = typeof window !== 'undefined' ? window.location : undefined
): boolean {
	if (!loc) return false;
	if (loc.protocol === 'fofline-spa:') return true;
	const host = (loc.hostname || '').toLowerCase();
	return host === 'fofline-spa.localhost';
}

export function normalizeRedirectUri(uri: string): string {
	if (typeof uri !== 'string' || !uri) return uri;
	const withoutHash = uri.split('#')[0];
	const normalized = withoutHash.startsWith(API_ORIGIN)
		? withoutHash.replace(API_ORIGIN, APP_ORIGIN)
		: withoutHash;
	return normalized;
}

/**
 * Default OIDC `redirect_uri` / `post_logout_redirect_uri` from the current page.
 * FoFline `fofline-spa://` has opaque `origin === "null"` — Linux uses the HTTPS
 * bridge so WebKitGTK can follow Keycloak's Location header; PKCE state still
 * stores this HTTPS URI and the local handoff only carries query params.
 */
export function resolveDefaultOidcRedirectUri(
	loc:
		| Pick<Location, 'protocol' | 'hostname' | 'pathname' | 'origin'>
		| null
		| undefined = typeof window !== 'undefined' ? window.location : undefined,
	pathnameOverride?: string
): string {
	if (!loc) {
		return normalizeRedirectUri(APP_ORIGIN);
	}
	const pathRaw =
		typeof pathnameOverride === 'string' && pathnameOverride.length > 0
			? pathnameOverride
			: typeof loc.pathname === 'string' && loc.pathname.length > 0
				? loc.pathname
				: '/';
	const path = pathRaw.startsWith('/') ? pathRaw : `/${pathRaw}`;

	if (loc.protocol === 'fofline-spa:') {
		// WebKitGTK fails HTTPS→custom-scheme redirects; bridge is HTTPS→HTTPS then JS handoff.
		return normalizeRedirectUri(`${APP_ORIGIN}${FOFLINE_OIDC_BRIDGE_PATH}`);
	}

	if (isOpaqueBrowserLocationOrigin(loc.origin)) {
		if (loc.protocol && loc.hostname) {
			return normalizeRedirectUri(`${loc.protocol}//${loc.hostname}${path}`);
		}
		return normalizeRedirectUri(APP_ORIGIN);
	}

	return normalizeRedirectUri(`${loc.origin}${path}`);
}
