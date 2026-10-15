/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for admin Users hub presence channel summary (compact table, tests).
 *
 * Invariants:
 * - `presence_sessions_web > 1` is a Socket.IO hygiene signal (multi-tab realtime), never a Keycloak/SSO failure.
 * - SSO browser active/live may stay healthy while the Socket.IO anomaly flag is on.
 *
 * Related:
 * - `pages/Admin/AdminUsersHubSection.tsx`
 * - documentation/platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md
 * - documentation/platform/BUG-MULTI-TAB-BROWSER-PRESENCE-OPEN-2026-05-23.md
 */

export type PresenceChannelInput = {
	presence_online?: boolean;
	presence_sessions_web?: number;
	presence_sessions_mobile?: number;
	sso_browser_active?: boolean;
	sso_browser_live?: boolean;
	sso_mobile_active?: boolean;
	sso_mobile_live?: boolean;
	sso_desktop_active?: boolean;
	sso_desktop_live?: boolean;
	sso_fofline_active?: boolean;
	sso_fofline_live?: boolean;
};

export function presenceAnomaly(u: PresenceChannelInput): boolean {
	return (u.presence_sessions_web ?? 0) > 1;
}

/** True when web Socket.IO count > 1 — tabs/realtime layer, not KC session limit. */
export function multiWebSocketIsNotKeycloakFailure(
	u: PresenceChannelInput
): boolean {
	return presenceAnomaly(u);
}

/** SSO browser registry looks present (active and/or live pulse). */
export function ssoBrowserChannelHealthy(u: PresenceChannelInput): boolean {
	return Boolean(u.sso_browser_active || u.sso_browser_live);
}

export function summarizePresenceChannels(u: PresenceChannelInput): {
	liveCount: number;
	totalChannels: number;
	anomaly: boolean;
	/** Anomaly with healthy SSO — operator must not treat as Keycloak outage. */
	anomalyNotKeycloak: boolean;
} {
	const webSock = u.presence_sessions_web ?? 0;
	const mobSock = u.presence_sessions_mobile ?? 0;
	const multiWebTab = webSock > 1;
	const anomaly = presenceAnomaly(u);
	const sockLive = Boolean(
		u.presence_online && (webSock > 0 || mobSock > 0) && !multiWebTab
	);
	const liveCount = [
		sockLive,
		Boolean(u.sso_browser_live),
		Boolean(u.sso_mobile_live),
		Boolean(u.sso_desktop_live),
		Boolean(u.sso_fofline_live),
	].filter(Boolean).length;
	return {
		liveCount,
		totalChannels: 5,
		anomaly,
		anomalyNotKeycloak: anomaly && ssoBrowserChannelHealthy(u),
	};
}
