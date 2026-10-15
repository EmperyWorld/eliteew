/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop/FoFline native OIDC adapter: hydrate access/id from a host-injected
 * `EmperyDesktopNativeOidc` bridge and refresh without a JS refresh token.
 *
 * Invariants:
 * - Does not import `keycloak.ts` / AuthOidcFacade (no facade cycle).
 * - Product WebView never `invoke`s `native_oidc_*` (main-window ACL).
 * - Bridge is active only when getBootstrapJson yields an access token
 *   (empty host inject keeps living browser PKCE).
 * - Refresh token from the bridge is ignored even if a host mistakenly sends it.
 * - Logout clears host keyring via `logoutSessionJson` → `product_session_logout`.
 * - If the host injected logoutSessionJson but IPC fails, logout throws (no fake SPA-only logout).
 * - Absent / empty bridge → callers keep living browser PKCE.
 *
 * Related:
 * - `keycloakEmbeddedOidc.ts` (mobile sibling)
 * - `documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md`
 */

import { log } from '../utils/logger';
import {
	type KeycloakTokenPersistence,
	persistKeycloakTokens,
	resolveTokenPersistence,
} from './keycloakTokenStorage';

const KEYCLOAK_LOG = 'Keycloak';

/** Host-injected bridge (launcher WebView). Not Tauri IPC from product.json. */
export interface EmperyDesktopNativeOidc {
	getBootstrapJson?: () => string;
	refreshSessionJson?: () => string | Promise<string>;
	logoutSessionJson?: () => string | Promise<string>;
}

export type WindowWithEmperyDesktopNativeOidc = Window & {
	EmperyDesktopNativeOidc?: EmperyDesktopNativeOidc;
};

export type DesktopNativeBridgeTokens = {
	accessToken: string;
	idToken?: string;
};

function readDesktopNativeOidcBridge(): EmperyDesktopNativeOidc | undefined {
	if (typeof window === 'undefined') {
		return undefined;
	}
	return (window as WindowWithEmperyDesktopNativeOidc).EmperyDesktopNativeOidc;
}

export function hasDesktopNativeOidcBridge(): boolean {
	const bridge = readDesktopNativeOidcBridge();
	if (!bridge?.getBootstrapJson) {
		return false;
	}
	try {
		const parsed = parseBridgeTokenJson(bridge.getBootstrapJson());
		return Boolean(accessFromParsed(parsed));
	} catch {
		return false;
	}
}

function parseBridgeTokenJson(raw: string): {
	ok?: boolean;
	token?: string;
	accessToken?: string;
	idToken?: string;
	refreshToken?: string;
	error?: string;
	persistence?: KeycloakTokenPersistence;
} {
	return JSON.parse(raw) as ReturnType<typeof parseBridgeTokenJson>;
}

function accessFromParsed(parsed: {
	token?: string;
	accessToken?: string;
}): string {
	return (parsed.accessToken || parsed.token || '').trim();
}

/**
 * Pull access/id into profile storage. Refresh is never persisted.
 */
export function hydrateDesktopNativeTokensFromNativeBridge(): void {
	const bridge = readDesktopNativeOidcBridge();
	if (!bridge?.getBootstrapJson) {
		return;
	}
	try {
		const parsed = parseBridgeTokenJson(bridge.getBootstrapJson());
		const token = accessFromParsed(parsed);
		if (!token) {
			return;
		}
		const idToken = parsed.idToken?.trim();
		persistKeycloakTokens(
			{
				token,
				idToken: idToken || undefined,
				savedAt: Date.now(),
			},
			parsed.persistence ?? resolveTokenPersistence()
		);
		if (parsed.refreshToken?.trim()) {
			log.warn(
				KEYCLOAK_LOG,
				'Desktop native OIDC bridge sent a refresh token; it was discarded'
			);
		}
		log.info(
			KEYCLOAK_LOG,
			'Hydrated desktop native OIDC access token from host bridge'
		);
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		log.warn(
			KEYCLOAK_LOG,
			`Desktop native OIDC bridge hydration failed: ${err.message}`
		);
	}
}

/**
 * Refresh owner is the host keyring. SPA must not POST /api/auth/refresh
 * and must not keep a JS refresh token.
 */
export async function refreshAccessTokenViaDesktopNativeBridge(): Promise<DesktopNativeBridgeTokens> {
	if (typeof window === 'undefined') {
		throw new Error(
			'Desktop native OIDC refresh bridge unavailable (no window)'
		);
	}
	const bridge = readDesktopNativeOidcBridge();
	if (!bridge?.refreshSessionJson) {
		throw new Error('Desktop native OIDC refresh bridge unavailable');
	}
	let parsed: ReturnType<typeof parseBridgeTokenJson>;
	try {
		const raw = await Promise.resolve(bridge.refreshSessionJson());
		parsed = parseBridgeTokenJson(raw);
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		throw new Error(`Desktop native OIDC refresh parse failed: ${err.message}`);
	}
	const accessToken = accessFromParsed(parsed);
	if (!parsed.ok || !accessToken) {
		throw new Error(
			parsed.error?.trim() || 'Desktop native OIDC refresh rejected session'
		);
	}
	return {
		accessToken,
		idToken: parsed.idToken?.trim() || undefined,
	};
}

/**
 * Clear host keyring refresh via product bridge (not native_oidc_logout IPC).
 * No-op when the host did not inject logoutSessionJson (living browser PKCE).
 */
export async function clearDesktopNativeOidcSessionViaBridge(): Promise<void> {
	if (typeof window === 'undefined') {
		return;
	}
	const bridge = readDesktopNativeOidcBridge();
	if (!bridge?.logoutSessionJson) {
		return;
	}
	try {
		const raw = await Promise.resolve(bridge.logoutSessionJson());
		const parsed = parseBridgeTokenJson(raw);
		if (parsed.ok === false && parsed.error?.trim()) {
			throw new Error(
				parsed.error.trim() || 'Desktop native OIDC logout rejected session'
			);
		}
		log.info(
			KEYCLOAK_LOG,
			'Cleared desktop native OIDC session via host bridge'
		);
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		log.warn(
			KEYCLOAK_LOG,
			`Desktop native OIDC logout bridge failed: ${err.message}`
		);
		throw err;
	}
}
