/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Date/name formatters and clipboard helper for admin Users catalog UI.
 *
 * Invariants:
 * - Formatting helpers are presentation-only and must not merge Socket.IO
 *   presence state with Keycloak SSO registry state.
 *
 * Related:
 * - ../AdminUserDetailPanel.tsx
 */

import i18n from 'i18next';
import { toast } from 'sonner';

export function formatDt(iso: string | null | undefined): string {
	if (!iso) return '—';
	try {
		return new Date(iso).toLocaleString();
	} catch {
		return iso;
	}
}

export function primaryName(u: {
	full_name?: string | null;
	username: string;
	email: string;
}): string {
	const n = (u.full_name || '').trim();
	if (n) return n;
	return u.username?.trim() || u.email?.trim() || '—';
}

export function shortenUa(
	ua: string | null | undefined,
	max = 48
): string | null {
	if (!ua?.trim()) return null;
	const t = ua.trim();
	return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function shortenUserAgent(
	ua: string | null | undefined,
	max = 72
): string {
	return shortenUa(ua, max) ?? '—';
}

/** @deprecated Use `formatRelativeActivityI18n` from `adminUsersFormatI18n.ts`. */
export function formatRelativeActivity(
	iso: string | null | undefined
): string | null {
	if (!iso) return null;
	try {
		const ts = new Date(iso).getTime();
		if (Number.isNaN(ts)) return null;
		const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
		if (sec < 60)
			return i18n.t('desktopUi:adminUsersHub.channels.secAgo', { n: sec });
		const min = Math.floor(sec / 60);
		if (min < 60)
			return i18n.t('desktopUi:adminUsersHub.channels.minAgo', { n: min });
		const h = Math.floor(min / 60);
		return i18n.t('desktopUi:adminUsersHub.channels.hoursAgo', { n: h });
	} catch {
		return null;
	}
}

/** @deprecated Use `channelStatusLabelI18n` from `adminUsersFormatI18n.ts`. */
export function channelStatusLabel(active: boolean, live?: boolean): string {
	return i18n.t(
		live
			? 'desktopUi:adminUsersHub.channels.online'
			: active
				? 'desktopUi:adminUsersHub.channels.recent'
				: 'desktopUi:adminUsersHub.channels.none'
	);
}

export async function copyTextToClipboard(text: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(text);
		toast.success(i18n.t('desktopUi:adminUsersHub.clipboard.copied'));
	} catch {
		toast.error(i18n.t('desktopUi:adminUsersHub.clipboard.failed'));
	}
}
