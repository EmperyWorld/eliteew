/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Apply Desktop UI language (ru|en): i18n + optional profile preferences PATCH.
 *
 * Invariants:
 * - Always updates i18n (localStorage via detector); profile persist is best-effort when authed.
 * - Reloads full `desktopUi` for the target language after change.
 *
 * Related:
 * - `src/i18n/config.ts`, `services/profileService.ts`
 * - `documentation/product/desktop/DESKTOP-SETTINGS-EVERYDAY-IA.md`
 */

import i18n, { ensureDesktopUiReady } from '@/i18n/config';
import profileService from '@/services/profileService';
import type { Language } from '@/types/profile';
import type { UserPreferences } from '@/types/profile';

export type DesktopUiLanguage = 'ru' | 'en';

export function normalizeDesktopUiLanguage(
	language: string | undefined | null
): DesktopUiLanguage {
	return language?.toLowerCase().startsWith('en') ? 'en' : 'ru';
}

export type ApplyDesktopUiLanguageResult = {
	language: DesktopUiLanguage;
	preferences: UserPreferences | null;
	persisted: boolean;
};

/**
 * Switch active UI language. When `persist` is true, also PATCH profile language.
 */
export async function applyDesktopUiLanguage(
	next: DesktopUiLanguage,
	options?: { persist?: boolean }
): Promise<ApplyDesktopUiLanguageResult> {
	const language = normalizeDesktopUiLanguage(next);
	await i18n.changeLanguage(language);
	await ensureDesktopUiReady();

	if (!options?.persist) {
		return { language, preferences: null, persisted: false };
	}

	try {
		const preferences = await profileService.updateLanguage(
			language as Language
		);
		return { language, preferences, persisted: true };
	} catch (error) {
		console.warn('[STEP] desktop_ui_language_persist_skip', error);
		return { language, preferences: null, persisted: false };
	}
}
