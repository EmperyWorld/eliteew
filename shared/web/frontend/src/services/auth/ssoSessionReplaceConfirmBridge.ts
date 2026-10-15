/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bridge between non-React SSO replace coordinator and desktop-styled confirm modal host.
 *
 * Invariants:
 * - At most one registered prompt handler; parallel callers await the same in-flight promise in coordinator.
 *
 * Related:
 * - services/auth/ssoSessionReplaceConfirm.ts, components/auth/SsoSessionReplaceConfirmHost.tsx
 */

export type SessionReplacePromptHandler = () => Promise<boolean>;

let sessionReplacePromptHandler: SessionReplacePromptHandler | null = null;

export function registerSessionReplacePromptHandler(
	handler: SessionReplacePromptHandler
): void {
	sessionReplacePromptHandler = handler;
}

export function unregisterSessionReplacePromptHandler(): void {
	sessionReplacePromptHandler = null;
}

export async function invokeSessionReplacePromptHandler(): Promise<boolean> {
	if (sessionReplacePromptHandler) {
		return sessionReplacePromptHandler();
	}
	if (typeof window === 'undefined') {
		return false;
	}
	return window.confirm(
		'This account already has an active web session in another browser. End that session and sign in here?'
	);
}
