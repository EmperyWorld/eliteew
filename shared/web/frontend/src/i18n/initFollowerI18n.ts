/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Minimal i18n bootstrap for follower / single-tab gate screens — `commonUi` only,
 * without pulling the full Desktop locale graph.
 *
 * Invariants:
 * - Same language detection key as full app (`eliteew_i18nextLng`).
 * - RU bundled; EN loaded eagerly here (tiny) so gate never shows raw keys.
 *
 * Related:
 * - `components/browserTabGate/BrowserSingleTabGateScreen.tsx`
 * - `followerMain.tsx`
 */

import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { COMMON_UI_NS } from './namespaces';
import ruCommonUi from './locales/ru/commonUi.json';
import enCommonUi from './locales/en/commonUi.json';

type SupportedLanguage = 'ru' | 'en';

function normalizeSupportedLanguage(
	language: string | undefined
): SupportedLanguage {
	return language?.toLowerCase().startsWith('en') ? 'en' : 'ru';
}

let followerI18nPromise: Promise<typeof i18n> | null = null;

/**
 * Idempotent: safe to call from follower entry and from tests.
 * If full-app i18n already initialized, still ensures commonUi bundles exist.
 */
export function initFollowerI18n(): Promise<typeof i18n> {
	if (followerI18nPromise) return followerI18nPromise;

	followerI18nPromise = (async () => {
		if (!i18n.isInitialized) {
			await i18n
				.use(LanguageDetector)
				.use(initReactI18next)
				.init({
					resources: {
						ru: { [COMMON_UI_NS]: ruCommonUi },
						en: { [COMMON_UI_NS]: enCommonUi },
					},
					supportedLngs: ['ru', 'en'],
					fallbackLng: 'ru',
					defaultNS: COMMON_UI_NS,
					ns: [COMMON_UI_NS],
					interpolation: { escapeValue: false },
					detection: {
						order: ['localStorage', 'navigator', 'htmlTag'],
						caches: ['localStorage'],
						lookupLocalStorage: 'eliteew_i18nextLng',
					},
				});
		} else {
			if (!i18n.hasResourceBundle('ru', COMMON_UI_NS)) {
				i18n.addResourceBundle('ru', COMMON_UI_NS, ruCommonUi, true, true);
			}
			if (!i18n.hasResourceBundle('en', COMMON_UI_NS)) {
				i18n.addResourceBundle('en', COMMON_UI_NS, enCommonUi, true, true);
			}
		}

		const lng = normalizeSupportedLanguage(
			i18n.resolvedLanguage ?? i18n.language
		);
		if (i18n.language !== lng) {
			await i18n.changeLanguage(lng);
		}
		return i18n;
	})();

	return followerI18nPromise;
}

export const followerI18nReady = initFollowerI18n();
