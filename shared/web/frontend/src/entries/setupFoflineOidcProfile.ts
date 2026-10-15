/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Select empery-fofline OIDC profile before Keycloak init when SPA runs as FoFline shell.
 *
 * Invariants:
 * - Must import from mainFullApp before initKeycloak (after desktopNative setup).
 * - FoFline query wins over desktopNative sticky when eliteewFoflineClient=1.
 * - Does not set mobileEmbedded / desktopNative; sticky flag only for foflineNative.
 *
 * Related:
 * - services/keycloakProfile.ts
 * - services/desktopClient/desktopClientSessionAssert.ts
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §5 / W2
 */

import { setOidcRuntimeProfile } from '@/services/keycloakProfile';
import { captureDesktopNativeLicenseBindFromUrl } from '@/services/desktopClient/desktopClientSessionAssert';
import { DESKTOP_NATIVE_FLAG_KEY } from '@/entries/setupDesktopNativeOidcProfile';

export const FOFLINE_NATIVE_FLAG_KEY = 'eliteew.foflineClient.v1';
export const FOFLINE_CLIENT_QUERY = 'eliteewFoflineClient';

function hasFoflineQueryFlag(): boolean {
	if (typeof window === 'undefined') {
		return false;
	}
	try {
		const params = new URLSearchParams(window.location.search);
		return params.get(FOFLINE_CLIENT_QUERY) === '1';
	} catch {
		return false;
	}
}

function hasFoflineStickyFlag(): boolean {
	try {
		return (
			sessionStorage.getItem(FOFLINE_NATIVE_FLAG_KEY) === '1' ||
			localStorage.getItem(FOFLINE_NATIVE_FLAG_KEY) === '1'
		);
	} catch {
		return false;
	}
}

function persistFoflineFlag(): void {
	try {
		sessionStorage.setItem(FOFLINE_NATIVE_FLAG_KEY, '1');
	} catch {
		/* ignore */
	}
}

function clearDesktopNativeSticky(): void {
	try {
		sessionStorage.removeItem(DESKTOP_NATIVE_FLAG_KEY);
		localStorage.removeItem(DESKTOP_NATIVE_FLAG_KEY);
	} catch {
		/* ignore */
	}
}

if (hasFoflineQueryFlag() || hasFoflineStickyFlag()) {
	if (hasFoflineQueryFlag()) {
		persistFoflineFlag();
		clearDesktopNativeSticky();
	}
	captureDesktopNativeLicenseBindFromUrl();
	setOidcRuntimeProfile('foflineNative');
	// P1: never leave OIDC tokens on host localStorage for foflineNative.
	try {
		localStorage.removeItem('eliteew.keycloak.foflineNative.oidcTokens.v1');
		localStorage.removeItem('eliteew.keycloak.foflineNative.oidcAuthState.v1');
		localStorage.removeItem('eliteew.keycloak.persistencePref.v1');
	} catch {
		/* ignore */
	}
}
