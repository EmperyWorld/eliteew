/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Selective localStorage purge for companion, Poemma, and desktop user-content islands on logout / session replace.
 *
 * Invariants:
 * - Never calls localStorage.clear(); only removes keys matching known principal-scoped prefixes and desktop PII keys.
 * - Poemma keys are scoped to the departing principal; companion draft/surface keys under eliteew.ewaCompanion.* purge entirely.
 * - Pre-auth/offline layout fallbacks (`elite_desktop_config`, `elite_desktop_items`) are never removed here.
 * - Device chrome prefs (theme, deploy version, clipboardPolicy toggle, guide audio) stay — not user-content islands.
 *
 * Related:
 * - documentation/product/FRONTEND_BROWSER_CACHE_MODEL.md §3.6, §6
 * - src/contexts/AuthContext.tsx
 * - src/features/poemma/poemmaStorage.ts
 * - src/pages/Desktop/constants/index.ts (STORAGE_KEYS)
 */

import { LAST_VISITED_PAGE_LOCAL_KEY } from '@/constants/storageKeys';
import { STORAGE_KEYS } from '@/pages/Desktop/constants';
import { DESKTOP_WIDGET_OUTBOX_STORAGE_KEY } from '@/pages/Desktop/utils/desktopWidgetOutboxQueue';
import { poemmaStoragePrefix } from '@/features/poemma/poemmaStorage';
import { VOICE_SETTINGS_STORAGE_KEY } from '@/voice-core/types';
import { log } from '@/utils/logger';

const LOG_COMPONENT = 'clearPrincipalScopedLocalStorage';

/** Legacy clipboard history key (ClipboardManager); migrated to shell_state when authenticated. */
export const DESKTOP_CLIPBOARD_HISTORY_LS_KEY = 'desktop-clipboard-history';

/** Companion LS namespaces purged on logout (see FRONTEND_BROWSER_CACHE_MODEL §6). */
const COMPANION_LS_PREFIXES = [
	'eliteew.ewaCompanion.',
	'eliteew.companion.',
	'ewa_companion_',
	'eliteew.ewa.surfaceLifecycle.',
] as const;

/** GAF Chat UX prefs (drafts, pins, thread prefs) — principal-scoped under eliteew.gafChat.* */
const GAF_CHAT_LS_PREFIX = 'eliteew.gafChat.';

/** Widget shelf offline mirror keys (prefix covers notes/todos/favorites). */
const DESKTOP_WIDGET_LS_PREFIX = 'elite_desktop_widget_';

/** EWRP slide-editor autosave drafts (`ewrp-draft-{jobId}`). */
const EWRP_DRAFT_LS_PREFIX = 'ewrp-draft-';

/**
 * Exact desktop / product LS keys with user content / activity — purged on every logout.
 * Does not include layout fallbacks used pre-auth (`CONFIG`, `ITEMS`) or device chrome prefs.
 */
const DESKTOP_USER_CONTENT_LS_EXACT_KEYS: readonly string[] = [
	DESKTOP_CLIPBOARD_HISTORY_LS_KEY,
	STORAGE_KEYS.WIDGET_NOTES,
	STORAGE_KEYS.WIDGET_TODOS,
	STORAGE_KEYS.WIDGET_FAVORITES,
	DESKTOP_WIDGET_OUTBOX_STORAGE_KEY,
	STORAGE_KEYS.RECENT_APPS,
	STORAGE_KEYS.RECENT_FILES,
	STORAGE_KEYS.NOTIFICATION_CENTER,
	STORAGE_KEYS.WINDOWS,
	LAST_VISITED_PAGE_LOCAL_KEY,
	'doc-search-history',
	'doc-recent-documents',
	VOICE_SETTINGS_STORAGE_KEY,
	'liveVoice_settings',
	'voice_command_center_history',
	'voice_command_center_macros',
	'transcriptionHistory',
	'eliteew-desktop-persist-patch-queue-v1',
	'marketing-cabinet-selected-company',
	'marketing-cabinet-selected-project',
	'desktop_ai_chat_pins',
	'eliteew-nowplaying',
	'eliteew-nowplaying-position',
	'eliteew-music-playlists',
	'eliteew.professionalWorlds.ewdeskAdminDraft.v1',
	'eliteew.imperorg.snapshot.v1',
	'eliteew.assistant.localFaq.v1',
] as const;

function normalizePrincipalId(
	principalId: string | null | undefined
): string | null {
	const normalized = principalId?.trim();
	return normalized ? normalized : null;
}

function companionKeyIncludesPrincipal(
	key: string,
	principalId: string
): boolean {
	return (
		key.includes(`:${principalId}`) ||
		key.endsWith(`.${principalId}`) ||
		key.endsWith(`::${principalId}`) ||
		key.includes(`::${principalId}::`)
	);
}

function desktopQuietModeKey(principalId: string): string {
	return `desktop_quiet_mode::${principalId}`;
}

function isDesktopUserContentLocalStorageKey(key: string): boolean {
	if (DESKTOP_USER_CONTENT_LS_EXACT_KEYS.includes(key)) {
		return true;
	}
	if (key.startsWith(DESKTOP_WIDGET_LS_PREFIX)) {
		return true;
	}
	if (key.startsWith(EWRP_DRAFT_LS_PREFIX)) {
		return true;
	}
	return false;
}

/**
 * Returns true when a localStorage key should be removed for the departing principal.
 * Exported for Vitest contract checks.
 */
export function shouldPurgePrincipalScopedLocalStorageKey(
	key: string,
	principalId: string | null | undefined
): boolean {
	const pid = normalizePrincipalId(principalId);
	const poemmaPrefix = pid ? poemmaStoragePrefix(pid) : null;
	if (poemmaPrefix && key.startsWith(poemmaPrefix)) {
		return true;
	}

	if (isDesktopUserContentLocalStorageKey(key)) {
		return true;
	}

	if (pid && key === desktopQuietModeKey(pid)) {
		return true;
	}

	if (key.startsWith(GAF_CHAT_LS_PREFIX)) {
		if (!pid) return true;
		return companionKeyIncludesPrincipal(key, pid);
	}

	if (key.startsWith('eliteew.ewaCompanion.')) {
		return true;
	}

	for (const prefix of COMPANION_LS_PREFIXES) {
		if (prefix === 'eliteew.ewaCompanion.') continue;
		if (!key.startsWith(prefix)) continue;
		if (!pid) return true;
		return companionKeyIncludesPrincipal(key, pid);
	}

	return false;
}

/**
 * Best-effort purge of companion/Poemma/desktop user-content localStorage islands for the departing user.
 * Safe to call when principalId is unknown — still removes global ewaCompanion.* and desktop PII keys.
 */
export function clearPrincipalScopedLocalStorage(
	principalId: string | null | undefined
): void {
	if (typeof window === 'undefined') return;

	const keysToRemove: string[] = [];
	try {
		for (let index = 0; index < window.localStorage.length; index += 1) {
			const key = window.localStorage.key(index);
			if (!key) continue;
			if (shouldPurgePrincipalScopedLocalStorageKey(key, principalId)) {
				keysToRemove.push(key);
			}
		}
	} catch (err) {
		log.debug(
			LOG_COMPONENT,
			'localStorage key enumeration failed during principal purge',
			err instanceof Error ? err : undefined
		);
		return;
	}

	for (const key of keysToRemove) {
		try {
			window.localStorage.removeItem(key);
		} catch (err) {
			log.debug(
				LOG_COMPONENT,
				`localStorage removeItem failed for ${key}`,
				err instanceof Error ? err : undefined
			);
		}
	}

	if (keysToRemove.length > 0) {
		log.info(
			LOG_COMPONENT,
			`Purged ${keysToRemove.length} principal-scoped localStorage key(s)`
		);
	}
}
