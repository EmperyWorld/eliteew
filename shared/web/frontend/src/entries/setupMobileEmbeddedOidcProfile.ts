/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Select empery-mobile OIDC profile before Keycloak init when SPA runs inside MobileAndroid EWA WebView.
 *
 * Invariants:
 * - Must import from mainFullApp before initKeycloak (client_id getter is evaluated at refresh time).
 *
 * Related:
 * - services/keycloakProfile.ts, pages/MobileEwaCompanion/MobileEwaCompanionPage.tsx
 */

import { setOidcRuntimeProfile } from '@/services/keycloakProfile';
import { isMobileEmbeddedSpaRoute } from '@/utils/mobileEmbeddedSpaRoute';

const ANDROID_WEBVIEW_UA_MARKERS = [
	'EmperyWorldAndroidWebView',
	'EmperyMobileEwaWebView',
	'EmperyMobileHandbookWebView',
	'EmperyMobileSocialHubWebView',
] as const;
const MOBILE_EMBEDDED_FLAG_KEY = 'eliteew.mobileEmbeddedClient.v1';
const MOBILE_EMBEDDED_TOKEN_KEY =
	'eliteew.keycloak.mobileEmbedded.oidcTokens.v1';

type NativeOidcBridge = {
	getBootstrapJson?: () => string;
};

function readNativeOidcBridgeTokens(): {
	token: string;
	refreshToken: string;
	persistence?: string;
} | null {
	if (typeof window === 'undefined') {
		return null;
	}
	const bridge = (
		window as Window & { EmperyMobileNativeOidc?: NativeOidcBridge }
	).EmperyMobileNativeOidc;
	if (!bridge?.getBootstrapJson) {
		return null;
	}
	try {
		const parsed = JSON.parse(bridge.getBootstrapJson()) as {
			token?: string;
			refreshToken?: string;
			persistence?: string;
		};
		const token = parsed.token?.trim();
		const refreshToken = parsed.refreshToken?.trim();
		if (!token || !refreshToken) {
			return null;
		}
		return {
			token,
			refreshToken,
			persistence: parsed.persistence,
		};
	} catch {
		return null;
	}
}

function persistNativeBridgeTokens(): boolean {
	const bridged = readNativeOidcBridgeTokens();
	if (!bridged) {
		return false;
	}
	try {
		localStorage.setItem(
			MOBILE_EMBEDDED_TOKEN_KEY,
			JSON.stringify({
				token: bridged.token,
				refreshToken: bridged.refreshToken,
				persistence: bridged.persistence ?? 'local',
				savedAt: Date.now(),
			})
		);
		localStorage.setItem(MOBILE_EMBEDDED_FLAG_KEY, '1');
		return true;
	} catch {
		return false;
	}
}

function isMobileEmbeddedSpaHashRoute(): boolean {
	return isMobileEmbeddedSpaRoute();
}

function hasMobileEmbeddedBootstrapFlag(): boolean {
	try {
		return localStorage.getItem(MOBILE_EMBEDDED_FLAG_KEY) === '1';
	} catch {
		return false;
	}
}

function hasMobileEmbeddedBootstrapTokens(): boolean {
	try {
		const raw = localStorage.getItem(MOBILE_EMBEDDED_TOKEN_KEY);
		if (!raw) return false;
		const parsed = JSON.parse(raw) as { refreshToken?: string; token?: string };
		return Boolean(parsed.refreshToken?.trim() && parsed.token?.trim());
	} catch {
		return false;
	}
}

function isMobileEmbeddedWebViewUserAgent(): boolean {
	if (typeof navigator === 'undefined') {
		return false;
	}
	const ua = navigator.userAgent || '';
	return ANDROID_WEBVIEW_UA_MARKERS.some((marker) => ua.includes(marker));
}

if (
	isMobileEmbeddedSpaHashRoute() ||
	hasMobileEmbeddedBootstrapFlag() ||
	hasMobileEmbeddedBootstrapTokens() ||
	isMobileEmbeddedWebViewUserAgent() ||
	persistNativeBridgeTokens()
) {
	setOidcRuntimeProfile('mobileEmbedded');
}
