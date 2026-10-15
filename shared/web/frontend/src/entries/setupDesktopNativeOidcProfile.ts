/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Select empery-desktop OIDC profile before Keycloak init when SPA runs in Tauri product Webview.
 * Wave K3–K4: stash eliteewOpenApp into pendingDesktopOpen (spa_deep_link allowlist only).
 *
 * Invariants:
 * - Must import from mainFullApp before initKeycloak.
 * - Does not set mobileEmbedded; sticky flag only for desktopNative.
 * - Open-app intent survives OIDC round-trip via sessionStorage (same origin).
 * - eliteewOpenApp accepted only for Kernel-offline spa_deep_link ids (generated allowlist).
 *
 * Related:
 * - services/keycloakProfile.ts
 * - pages/Desktop/utils/pendingDesktopOpen.ts
 * - pages/Desktop/shell/kernelOfflineSpaDeepLink.ts
 * - host/kernel-offline/kernelOfflineMounts.policy.json
 * - documentation/product/desktop/DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md
 */

import { setOidcRuntimeProfile } from '@/services/keycloakProfile';
import { queuePendingDesktopOpen } from '@/pages/Desktop/utils/pendingDesktopOpen';
import { isKernelOfflineSpaDeepLinkAppId } from '@/pages/Desktop/shell/kernelOfflineSpaDeepLink';
import { captureDesktopNativeLicenseBindFromUrl } from '@/services/desktopClient/desktopClientSessionAssert';

export const DESKTOP_NATIVE_FLAG_KEY = 'eliteew.desktopNativeClient.v1';
export const DESKTOP_CLIENT_QUERY = 'eliteewDesktopClient';
/** Kernel offline spa_deep_link → cloud Desktop mount (matches desktop-client SPA_OPEN_APP_QUERY). */
export const DESKTOP_OPEN_APP_QUERY = 'eliteewOpenApp';

const OPEN_APP_COMPONENT_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

function hasFoflineQueryConflict(): boolean {
	if (typeof window === 'undefined') {
		return false;
	}
	try {
		const params = new URLSearchParams(window.location.search);
		return params.get('eliteewFoflineClient') === '1';
	} catch {
		return false;
	}
}

function hasDesktopNativeQueryFlag(): boolean {
	if (typeof window === 'undefined') {
		return false;
	}
	try {
		const params = new URLSearchParams(window.location.search);
		return params.get(DESKTOP_CLIENT_QUERY) === '1';
	} catch {
		return false;
	}
}

function hasDesktopNativeStickyFlag(): boolean {
	try {
		return (
			sessionStorage.getItem(DESKTOP_NATIVE_FLAG_KEY) === '1' ||
			localStorage.getItem(DESKTOP_NATIVE_FLAG_KEY) === '1'
		);
	} catch {
		return false;
	}
}

function persistDesktopNativeFlag(): void {
	try {
		sessionStorage.setItem(DESKTOP_NATIVE_FLAG_KEY, '1');
	} catch {
		/* ignore */
	}
}

/**
 * Read eliteewOpenApp, queue pending Desktop open, strip query (keep eliteewDesktopClient).
 * Safe no-op when param missing, invalid, or not in spa_deep_link allowlist.
 */
export function captureDesktopNativeOpenAppIntentFromUrl(): string | null {
	if (typeof window === 'undefined') {
		return null;
	}
	try {
		const url = new URL(window.location.href);
		const raw = (url.searchParams.get(DESKTOP_OPEN_APP_QUERY) || '').trim();
		if (!raw || !OPEN_APP_COMPONENT_RE.test(raw)) {
			return null;
		}
		if (!isKernelOfflineSpaDeepLinkAppId(raw)) {
			url.searchParams.delete(DESKTOP_OPEN_APP_QUERY);
			window.history.replaceState(null, '', url.toString());
			return null;
		}
		queuePendingDesktopOpen({ kind: 'app', appComponent: raw });
		url.searchParams.delete(DESKTOP_OPEN_APP_QUERY);
		window.history.replaceState(null, '', url.toString());
		return raw;
	} catch {
		return null;
	}
}

// FoFline query wins: do not set desktopNative when eliteewFoflineClient=1 (W2 dual-flag).
if (
	!hasFoflineQueryConflict() &&
	(hasDesktopNativeQueryFlag() || hasDesktopNativeStickyFlag())
) {
	if (hasDesktopNativeQueryFlag()) {
		persistDesktopNativeFlag();
	}
	captureDesktopNativeOpenAppIntentFromUrl();
	captureDesktopNativeLicenseBindFromUrl();
	setOidcRuntimeProfile('desktopNative');
}
