/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bridge from embedded SPA pages to MobileAndroid WebView host (close toolbar parity).
 *
 * Invariants:
 * - No-op outside EmperyMobileEmbeddedSpaWebViewActivity.
 *
 * Related:
 * - EmperyMobileEmbeddedSpaWebViewActivity.kt, MobileEmbeddedSpaChrome.tsx
 */

type EmbeddedSpaChromeBridge = {
	close?: () => void;
};

export function closeMobileEmbeddedSpa(): void {
	if (typeof window === 'undefined') {
		return;
	}
	const bridge = (
		window as Window & {
			EmperyMobileEmbeddedChrome?: EmbeddedSpaChromeBridge;
		}
	).EmperyMobileEmbeddedChrome;
	try {
		bridge?.close?.();
	} catch {
		/* ignore — host may not expose bridge yet */
	}
}
