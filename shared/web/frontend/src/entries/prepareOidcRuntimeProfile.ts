/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Select the OIDC runtime profile before auth while keeping the normal web boot
 * path free from native Desktop/mobile setup graphs.
 *
 * Invariants:
 * - Mobile embedded wins over native Desktop profile detection.
 * - FoFline query/sticky state wins over desktopNative sticky state.
 * - Native setup modules are imported only for matching runtimes.
 *
 * Related:
 * - `setupMobileEmbeddedOidcProfile.ts`
 * - `setupDesktopNativeOidcProfile.ts`, `setupFoflineOidcProfile.ts`
 */

import { isEmbeddedEliteEWClient } from '@/utils/eliteewEmbeddedClient';
import { isMobileEmbeddedSpaRoute } from '@/utils/mobileEmbeddedSpaRoute';

const DESKTOP_NATIVE_FLAG_KEY = 'eliteew.desktopNativeClient.v1';
const DESKTOP_CLIENT_QUERY = 'eliteewDesktopClient';
const FOFLINE_NATIVE_FLAG_KEY = 'eliteew.foflineClient.v1';
const FOFLINE_CLIENT_QUERY = 'eliteewFoflineClient';

function hasQueryFlag(name: string): boolean {
	if (typeof window === 'undefined') {
		return false;
	}
	try {
		return new URLSearchParams(window.location.search).get(name) === '1';
	} catch {
		return false;
	}
}

function hasStorageFlag(name: string): boolean {
	try {
		return (
			sessionStorage.getItem(name) === '1' || localStorage.getItem(name) === '1'
		);
	} catch {
		return false;
	}
}

function hasMobileEmbeddedTokenHint(): boolean {
	try {
		return Boolean(
			localStorage.getItem('eliteew.mobileEmbeddedClient.v1') === '1' ||
				localStorage.getItem('eliteew.androidWebView.keycloakTokens.v1') ||
				localStorage.getItem('eliteew.keycloak.mobileEmbedded.oidcTokens.v1')
		);
	} catch {
		return false;
	}
}

export async function prepareOidcRuntimeProfile(): Promise<void> {
	if (
		isEmbeddedEliteEWClient() ||
		isMobileEmbeddedSpaRoute() ||
		hasMobileEmbeddedTokenHint()
	) {
		await import('./setupMobileEmbeddedOidcProfile');
		return;
	}

	const fofline =
		hasQueryFlag(FOFLINE_CLIENT_QUERY) ||
		hasStorageFlag(FOFLINE_NATIVE_FLAG_KEY);
	if (fofline) {
		// FoFline setup imports constants from desktop setup and intentionally wins.
		await import('./setupDesktopNativeOidcProfile');
		await import('./setupFoflineOidcProfile');
		return;
	}

	if (
		hasQueryFlag(DESKTOP_CLIENT_QUERY) ||
		hasStorageFlag(DESKTOP_NATIVE_FLAG_KEY)
	) {
		await import('./setupDesktopNativeOidcProfile');
	}
}
