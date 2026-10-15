/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Best-effort FoFline product WebView wipe after logout (Tauri invoke only).
 *
 * Invariants:
 * - Product class is `foflineNative`. Host I/O is `hasTauriInvoke()`.
 * - EmpiierOS has no Tauri wipe command; JS logout still runs.
 * - Never throws into logout cascade.
 *
 * Related:
 * - authSessionCoordinator.ts
 * - DESKTOP-FOFLINE-EDITION.md L5 / sterile P1
 */

import { getOidcRuntimeProfile } from '@/services/keycloakProfile';
import { hasTauriInvoke } from '@/services/desktopClient/eliteewProductHost';

type TauriInternals = {
	invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
};

/** Clear Tauri product WebView data. No-op on EmpiierOS (no invoke). */
export function requestFoflineProductWebviewWipe(): void {
	if (getOidcRuntimeProfile() !== 'foflineNative') return;
	if (!hasTauriInvoke() || typeof window === 'undefined') return;
	const internals = (
		window as Window & { __TAURI_INTERNALS__?: TauriInternals }
	).__TAURI_INTERNALS__;
	if (!internals?.invoke) return;
	void internals.invoke('product_webview_wipe').catch(() => {
		/* wipe is best-effort — logout must continue */
	});
}
