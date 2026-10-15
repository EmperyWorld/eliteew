/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Detect operator-visible channel mismatches between Socket.IO and SSO in Users directory.
 *
 * Invariants:
 * - Heuristics only; channels may legitimately diverge during connect/disconnect windows.
 *
 * Related:
 * - `pages/Admin/adminUserPresenceSummary.ts`
 * - documentation/platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md
 */

import type { PresenceChannelInput } from './adminUserPresenceSummary';

export type AdminUserChannelMismatchKind =
	| 'sso_browser_without_socket'
	| 'socket_without_sso_browser';

export function detectAdminUserChannelMismatch(
	u: PresenceChannelInput
): AdminUserChannelMismatchKind | null {
	const webSock = u.presence_sessions_web ?? 0;
	const ssoBrowser = Boolean(u.sso_browser_active);
	const socketLive = Boolean(
		u.presence_online && (webSock > 0 || (u.presence_sessions_mobile ?? 0) > 0)
	);
	if (ssoBrowser && webSock === 0 && !socketLive) {
		return 'sso_browser_without_socket';
	}
	if (socketLive && webSock > 0 && !ssoBrowser) {
		return 'socket_without_sso_browser';
	}
	return null;
}

/** @deprecated Prefer `adminUserChannelMismatchLabelI18n` with `useTranslation`. */
export function adminUserChannelMismatchLabel(
	kind: AdminUserChannelMismatchKind
): string {
	if (kind === 'sso_browser_without_socket') {
		return 'SSO web without Socket.IO';
	}
	return 'Socket.IO without SSO web';
}
