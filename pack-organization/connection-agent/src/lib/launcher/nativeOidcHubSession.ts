/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Hub Start helper: native interactive OIDC must succeed before product_open.
 *
 * Invariants:
 * - Wave 7 enforce: native failure does not open the product (no living PKCE
 *   soft-continue, no SPA in the auth window).
 * - User-facing deny copy is Russian — never surface opaque English as Hub detail.
 * - Never invokes native_oidc_* from product WebView — Hub main window only.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md §9.9
 */

import {
	nativeOidcInteractiveLogin,
	type NativeOidcClient,
	type NativeOidcCommandView,
} from '../tauri-bridge/commands';

export type HubNativeOidcEnsureResult = {
	nativeOk: boolean;
	view: NativeOidcCommandView | null;
	detail: string | null;
};

/** User-facing deny when native login did not complete (RU). */
export const HUB_NATIVE_REQUIRED_RU =
	'Вход не завершён. Приложение откроется после успешного входа.';

function isOpaqueNativeDenyMessage(message: string | null | undefined): boolean {
	const t = message?.trim() ?? '';
	if (!t) return true;
	const lower = t.toLowerCase();
	return (
		lower === 'authentication could not be completed' ||
		lower.includes('auth_policy_denied') ||
		lower === 'sign-in was cancelled or timed out'
	);
}

export async function ensureNativeOidcBeforeProductOpen(input: {
	client: NativeOidcClient;
	licenseId: string;
	deviceId?: string | null;
}): Promise<HubNativeOidcEnsureResult> {
	try {
		const view = await nativeOidcInteractiveLogin({
			client: input.client,
			licenseId: input.licenseId,
			deviceId: input.deviceId ?? null,
		});
		if (view.ok) {
			return {
				nativeOk: true,
				view,
				detail: null,
			};
		}
		const raw = view.message?.trim() || null;
		return {
			nativeOk: false,
			view,
			detail: isOpaqueNativeDenyMessage(raw)
				? HUB_NATIVE_REQUIRED_RU
				: raw,
		};
	} catch (err) {
		const raw =
			err instanceof Error && err.message.trim() ? err.message.trim() : null;
		return {
			nativeOk: false,
			view: null,
			detail: isOpaqueNativeDenyMessage(raw)
				? HUB_NATIVE_REQUIRED_RU
				: raw,
		};
	}
}
