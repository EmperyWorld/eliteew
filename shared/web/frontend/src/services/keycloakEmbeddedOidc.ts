/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mobile-embedded OIDC helpers for WebView shells: detect embedded context,
 * hydrate tokens from `EmperyMobileNativeOidc`, and refresh via the native
 * bridge (AuthRepository sole owner — not SPA `/api/auth/refresh`).
 *
 * Invariants:
 * - Does not import `keycloak.ts` / AuthOidcFacade (no facade cycle).
 * - Refresh returns token pair only; facade applies tokens + callbacks.
 * - Hydration persists via `persistKeycloakTokens` and sets mobileEmbedded profile.
 *
 * Related:
 * - `services/keycloak.ts`, `keycloakTokenStorage.ts`, `keycloakProfile.ts`,
 *   `documentation/product/FRONTEND-AUTH.md`,
 *   `documentation/product/mobile/MOBILE-ANDROID-EMBEDDED-SPA-WEBVIEW-TEMPLATE.md`
 */

import { isEmbeddedEliteEWClient } from '../utils/eliteewEmbeddedClient';
import { log } from '../utils/logger';
import {
	getOidcRuntimeProfile,
	setOidcRuntimeProfile,
} from './keycloakProfile';
import {
	type KeycloakTokenPersistence,
	persistKeycloakTokens,
} from './keycloakTokenStorage';

const KEYCLOAK_LOG = 'Keycloak';
const MOBILE_EMBEDDED_FLAG_KEY = 'eliteew.mobileEmbeddedClient.v1';

/** Native Android WebView bridge injected for mobileEmbedded OIDC. */
export interface EmperyMobileNativeOidc {
	getBootstrapJson?: () => string;
	refreshSessionJson?: () => string;
}

export type WindowWithEmperyMobileNativeOidc = Window & {
	EmperyMobileNativeOidc?: EmperyMobileNativeOidc;
};

export type NativeBridgeRefreshTokens = {
	accessToken: string;
	refreshToken: string;
};

export function isMobileEmbeddedOidcContext(): boolean {
	return (
		getOidcRuntimeProfile() === 'mobileEmbedded' || isEmbeddedEliteEWClient()
	);
}

export function accessTokenStillValid(
	tokenParsed: { exp?: number } | undefined,
	minValiditySec = 60
): boolean {
	const exp = tokenParsed?.exp;
	if (!exp) return false;
	return exp - Math.floor(Date.now() / 1000) > minValiditySec;
}

function readNativeOidcBridge(): EmperyMobileNativeOidc | undefined {
	if (typeof window === 'undefined') {
		return undefined;
	}
	return (window as WindowWithEmperyMobileNativeOidc).EmperyMobileNativeOidc;
}

/**
 * Pull bootstrap tokens from the native bridge into profile token storage.
 * Side-effect only on storage / profile — does not touch AuthOidcFacade state.
 */
export function hydrateMobileEmbeddedTokensFromNativeBridge(): void {
	const bridge = readNativeOidcBridge();
	if (!bridge?.getBootstrapJson) {
		return;
	}
	try {
		const parsed = JSON.parse(bridge.getBootstrapJson()) as {
			token?: string;
			refreshToken?: string;
			persistence?: KeycloakTokenPersistence;
		};
		const token = parsed.token?.trim();
		const refreshToken = parsed.refreshToken?.trim();
		if (!token || !refreshToken) {
			return;
		}
		const mode = parsed.persistence ?? 'local';
		persistKeycloakTokens(
			{
				token,
				refreshToken,
				savedAt: Date.now(),
			},
			mode
		);
		localStorage.setItem(MOBILE_EMBEDDED_FLAG_KEY, '1');
		setOidcRuntimeProfile('mobileEmbedded');
		log.info(
			KEYCLOAK_LOG,
			'Hydrated mobile embedded OIDC tokens from native bridge'
		);
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		log.warn(
			KEYCLOAK_LOG,
			`Native OIDC bridge hydration failed: ${err.message}`
		);
	}
}

/**
 * Sole refresh owner for empery-mobile tokens is native AuthRepository.
 * Embedded SPA must not POST /api/auth/refresh (Keycloak refresh reuse).
 * Returns token pair; caller (facade) applies tokens and fires refresh callbacks.
 */
export function refreshAccessTokenViaNativeBridge(): NativeBridgeRefreshTokens {
	if (typeof window === 'undefined') {
		throw new Error('Native OIDC refresh bridge unavailable (no window)');
	}
	const bridge = readNativeOidcBridge();
	if (!bridge?.refreshSessionJson) {
		throw new Error('Native OIDC refresh bridge unavailable');
	}
	let parsed: {
		ok?: boolean;
		token?: string;
		refreshToken?: string;
		error?: string;
	};
	try {
		parsed = JSON.parse(bridge.refreshSessionJson()) as typeof parsed;
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		throw new Error(`Native OIDC refresh parse failed: ${err.message}`);
	}
	if (!parsed.ok || !parsed.token?.trim() || !parsed.refreshToken?.trim()) {
		throw new Error(
			parsed.error?.trim() || 'Native OIDC refresh rejected session'
		);
	}
	return {
		accessToken: parsed.token.trim(),
		refreshToken: parsed.refreshToken.trim(),
	};
}
