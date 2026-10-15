/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Deep-link `?section=desktopAiChat&aiChatTab=` for Desktop AI Chat admin sub-tabs.
 *
 * Invariants:
 * - Legacy `?section=system&aiChatTab=` is still readable; migrate via `migrateLegacyDesktopAiChatAdminShellUrl`.
 *
 * Related:
 * - pages/Admin/desktopAiChat/DesktopAiChatAdminSection.tsx
 * - pages/Admin/shell/adminShellUrl.ts
 */

import type { DesktopAiChatAdminTab } from './desktopAiChatAdminTypes';

export const DESKTOP_AI_CHAT_ADMIN_SECTION_ID = 'desktopAiChat' as const;

const VALID_TABS: ReadonlySet<DesktopAiChatAdminTab> = new Set([
	'overview',
	'defaults',
	'memoryCells',
	'blueprint',
	'templates',
	'diagnostics',
]);

export function isDesktopAiChatAdminTab(
	value: string
): value is DesktopAiChatAdminTab {
	return VALID_TABS.has(value as DesktopAiChatAdminTab);
}

function isDesktopAiChatAdminSectionParam(section: string | null): boolean {
	return section === DESKTOP_AI_CHAT_ADMIN_SECTION_ID || section === 'system';
}

export function readDesktopAiChatAdminTabFromUrl(
	search?: string
): DesktopAiChatAdminTab | null {
	if (typeof window === 'undefined' && search == null) {
		return null;
	}
	try {
		const raw =
			search ?? (typeof window !== 'undefined' ? window.location.search : '');
		const params = new URLSearchParams(raw);
		if (!isDesktopAiChatAdminSectionParam(params.get('section'))) {
			return null;
		}
		const tab = params.get('aiChatTab');
		if (tab && isDesktopAiChatAdminTab(tab)) {
			return tab;
		}
	} catch {
		/* ignore */
	}
	return null;
}

export function syncDesktopAiChatAdminTabToUrl(
	tab: DesktopAiChatAdminTab,
	opts?: { enabled?: boolean }
): void {
	if (opts?.enabled === false || typeof window === 'undefined') {
		return;
	}
	try {
		const url = new URL(window.location.href);
		if (url.searchParams.get('section') !== DESKTOP_AI_CHAT_ADMIN_SECTION_ID) {
			return;
		}
		url.searchParams.set('aiChatTab', tab);
		const next = `${url.pathname}${url.search}${url.hash}`;
		if (
			`${window.location.pathname}${window.location.search}${window.location.hash}` !==
			next
		) {
			window.history.replaceState(null, '', next);
		}
	} catch {
		/* ignore */
	}
}

/** Rewrite legacy System deep links to the dedicated Desktop AI Chat section. */
export function migrateLegacyDesktopAiChatAdminShellUrl(opts?: {
	enabled?: boolean;
}): void {
	if (opts?.enabled === false || typeof window === 'undefined') {
		return;
	}
	try {
		const url = new URL(window.location.href);
		const tab = url.searchParams.get('aiChatTab');
		if (
			url.searchParams.get('section') !== 'system' ||
			!tab ||
			!isDesktopAiChatAdminTab(tab)
		) {
			return;
		}
		url.searchParams.set('section', DESKTOP_AI_CHAT_ADMIN_SECTION_ID);
		const next = `${url.pathname}${url.search}${url.hash}`;
		if (
			`${window.location.pathname}${window.location.search}${window.location.hash}` !==
			next
		) {
			window.history.replaceState(null, '', next);
		}
	} catch {
		/* ignore */
	}
}
