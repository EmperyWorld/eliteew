/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * i18n helpers for auth/session toasts and SSO replace copy outside React components.
 *
 * Invariants:
 * - Namespace is always `desktopUi:sessionAuth.*`; callers must not hardcode user strings.
 *
 * Related:
 * - services/api/client.ts, services/auth/ssoSessionReplaceConfirm.ts, contexts/AuthContext.tsx
 */

import i18n from '@/i18n/config';

const SESSION_AUTH_NS = 'desktopUi';

export function tSessionAuth(
	key: string,
	options?: Record<string, unknown>
): string {
	return i18n.t(`sessionAuth.${key}`, { ns: SESSION_AUTH_NS, ...options });
}
