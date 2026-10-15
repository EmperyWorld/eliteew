/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve whether companion reactive window chrome is enabled for this deployment.
 *
 * Invariants:
 * - Server flag on companion profile GET is authoritative; omitted field defaults to enabled.
 *
 * Related:
 * - api/ewa_platform/companion/ux/reactive_chrome.py
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */
export function isEwaCompanionReactiveChromeEnabled(
	profile: { reactive_chrome_enabled?: boolean | null } | null | undefined
): boolean {
	if (profile == null) return true;
	return profile.reactive_chrome_enabled !== false;
}
