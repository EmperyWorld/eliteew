/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Deep-link `?section=` for unified admin and strip Users-only query keys when leaving that section.
 *
 * Invariants:
 * - Does not touch Users managed params when `section=users`; strips them when switching away.
 * - No-op when `window` is unavailable (SSR) or updates are disabled (embedded desktop window).
 *
 * Related:
 * - `pages/Admin/adminUsersUrlFilters.ts`
 * - `pages/Admin/UnifiedAdminPage.tsx`
 */

import type { AdminSectionId } from './adminShellConfig';
import { isAdminSectionId } from './adminShellConfig';
import {
	DESKTOP_AI_CHAT_ADMIN_SECTION_ID,
	isDesktopAiChatAdminTab,
} from '../desktopAiChat/desktopAiChatAdminUrl';
import {
	LEGACY_UGS_ADMIN_SECTION_ID,
	UGS_ADMIN_SHELL_SECTION_ID,
} from './ugsAdminShellUrl';

/** Keys owned by Admin Users hub URL sync — cleared when leaving `users`. */
const USERS_ONLY_QUERY_KEYS = [
	'q',
	'role',
	'active',
	'trusted',
	'verified',
	'online',
	'group',
	'anomaly',
	'ssoBrowser',
	'ssoMobile',
	'sort',
	'page',
	'userId',
	'userTab',
	'view',
	'mismatch',
] as const;

/** Cleared when leaving раздел «Обращения». */
export const FEEDBACK_ONLY_QUERY_KEYS = [
	'ticket',
	'status',
	'kind',
	'q',
	'includeClosed',
] as const;

/** Cleared when leaving раздел Social Hub reports. */
export const SOCIAL_REPORTS_ONLY_QUERY_KEYS = [
	'report',
	'status',
	'q',
] as const;

const SEARCH_ONLY_QUERY_KEYS = ['searchTab'] as const;
const MUSIC_FORGE_ONLY_QUERY_KEYS = ['musicForgeTab'] as const;
const CONTENT_ONLY_QUERY_KEYS = ['contentTab'] as const;
const KBSEW_ONLY_QUERY_KEYS = ['kbsewTab'] as const;
const DESKTOP_AI_CHAT_ONLY_QUERY_KEYS = ['aiChatTab'] as const;
const WORKERS_ONLY_QUERY_KEYS = ['workersTab'] as const;
const PLATFORM_OPS_ONLY_QUERY_KEYS = ['platformOpsTab'] as const;

function queryKeysToClearWhenEntering(
	targetSection: AdminSectionId
): readonly string[] {
	const keys: string[] = [];
	if (targetSection !== 'users') {
		keys.push(...USERS_ONLY_QUERY_KEYS);
	}
	if (targetSection !== 'feedback') {
		for (const key of FEEDBACK_ONLY_QUERY_KEYS) {
			// `q` is shared with Users catalog search — keep it when entering `users`.
			if (targetSection === 'users' && key === 'q') continue;
			if (
				targetSection === 'socialReports' &&
				(key === 'q' || key === 'status')
			) {
				continue;
			}
			keys.push(key);
		}
	}
	if (targetSection !== 'socialReports') {
		for (const key of SOCIAL_REPORTS_ONLY_QUERY_KEYS) {
			if (targetSection === 'users' && key === 'q') continue;
			if (targetSection === 'feedback' && (key === 'q' || key === 'status')) {
				continue;
			}
			keys.push(key);
		}
	}
	if (targetSection !== 'search') {
		keys.push(...SEARCH_ONLY_QUERY_KEYS);
	}
	if (targetSection !== 'musicForge') {
		keys.push(...MUSIC_FORGE_ONLY_QUERY_KEYS);
	}
	if (targetSection !== 'content') {
		keys.push(...CONTENT_ONLY_QUERY_KEYS);
	}
	if (targetSection !== 'kbsew') {
		keys.push(...KBSEW_ONLY_QUERY_KEYS);
	}
	if (targetSection !== DESKTOP_AI_CHAT_ADMIN_SECTION_ID) {
		keys.push(...DESKTOP_AI_CHAT_ONLY_QUERY_KEYS);
	}
	if (targetSection !== 'workers') {
		keys.push(...WORKERS_ONLY_QUERY_KEYS);
	}
	if (targetSection !== 'platformOps') {
		keys.push(...PLATFORM_OPS_ONLY_QUERY_KEYS);
	}
	return keys;
}

export function readAdminSectionFromUrl(
	search?: string
): AdminSectionId | null {
	if (typeof window === 'undefined' && search == null) {
		return null;
	}
	try {
		const raw =
			search ?? (typeof window !== 'undefined' ? window.location.search : '');
		const params = new URLSearchParams(raw);
		const section = params.get('section');
		const aiChatTab = params.get('aiChatTab');
		if (
			section === 'system' &&
			aiChatTab &&
			isDesktopAiChatAdminTab(aiChatTab)
		) {
			return DESKTOP_AI_CHAT_ADMIN_SECTION_ID;
		}
		if (section === LEGACY_UGS_ADMIN_SECTION_ID) {
			return UGS_ADMIN_SHELL_SECTION_ID;
		}
		if (section && isAdminSectionId(section)) {
			return section;
		}
	} catch {
		/* ignore */
	}
	return null;
}

export function syncAdminShellSectionToUrl(
	section: AdminSectionId,
	opts?: { enabled?: boolean }
): void {
	if (opts?.enabled === false || typeof window === 'undefined') {
		return;
	}
	try {
		const url = new URL(window.location.href);
		for (const key of queryKeysToClearWhenEntering(section)) {
			url.searchParams.delete(key);
		}
		url.searchParams.set('section', section);
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
