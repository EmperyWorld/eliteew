/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * i18n bootstrap for EliteEW frontend. Cold `#desktop` ships only shell namespaces;
 * product locales (including full `desktopUi`) load on demand via `eliteewLazyLocaleBackend`.
 *
 * Invariants:
 * - RU cold: `commonUi` + `desktopChrome` (also seeded into `desktopUi` until full UI locale loads).
 * - Full `desktopUi` must be force-reloaded via `reloadResources` — a chrome-only seed marks
 *   the namespace loaded, so plain `loadNamespaces('desktopUi')` never hits the backend.
 * - Full `desktopUi` loads only at its route boundary; other product namespaces
 *   load with their owning route/application.
 * - `pnpm run i18n:check` still requires every en key to exist in ru.
 *
 * Related:
 * - src/i18n/namespaces.ts
 * - src/i18n/lazyLocaleBackend.ts
 * - src/i18n/mergeDesktopUiWithChrome.ts
 */
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { COMMON_UI_NS, DESKTOP_CHROME_NS, DESKTOP_UI_NS } from './namespaces';
import { eliteewLazyLocaleBackend } from './lazyLocaleBackend';
import { mergeDesktopUiWithChrome } from './mergeDesktopUiWithChrome';

import ruCommonUi from './locales/ru/commonUi.json';
import ruDesktopChrome from './locales/ru/desktopChrome.json';

/** Namespaces required before first paint of idle `#desktop` chrome. */
export const COLD_RU_NAMESPACES = [COMMON_UI_NS, DESKTOP_CHROME_NS] as const;

type SupportedLanguage = 'ru' | 'en';

function normalizeSupportedLanguage(
	language: string | undefined
): SupportedLanguage {
	return language?.toLowerCase().startsWith('en') ? 'en' : 'ru';
}

function seedDesktopUiFromChrome(language: SupportedLanguage): void {
	if (!i18n.hasResourceBundle(language, DESKTOP_CHROME_NS)) return;
	const chrome = i18n.getResourceBundle(language, DESKTOP_CHROME_NS) as Record<
		string,
		unknown
	>;
	i18n.addResourceBundle(language, DESKTOP_UI_NS, chrome, true, true);
}

/**
 * Ensure a language has its cold shell bundles (EN cold is also lazy-loaded once).
 */
async function ensureColdLanguageResources(
	language: SupportedLanguage
): Promise<void> {
	if (language === 'ru') {
		seedDesktopUiFromChrome('ru');
		return;
	}
	await i18n.loadNamespaces([...COLD_RU_NAMESPACES]);
	seedDesktopUiFromChrome('en');
}

const i18nInitPromise = i18n
	.use(eliteewLazyLocaleBackend)
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		partialBundledLanguages: true,
		resources: {
			ru: {
				[COMMON_UI_NS]: ruCommonUi,
				[DESKTOP_CHROME_NS]: ruDesktopChrome,
				// Tray/taskbar keys available under desktopUi until full locale loads.
				[DESKTOP_UI_NS]: ruDesktopChrome,
			},
		},
		supportedLngs: ['ru', 'en'],
		fallbackLng: 'ru',
		defaultNS: COMMON_UI_NS,
		ns: [...COLD_RU_NAMESPACES],
		interpolation: { escapeValue: false },
		detection: {
			order: ['localStorage', 'navigator', 'htmlTag'],
			caches: ['localStorage'],
			lookupLocalStorage: 'eliteew_i18nextLng',
		},
	});

/**
 * Chrome seed puts a partial `desktopUi` bundle in resources. i18next then treats the
 * namespace as already loaded and skips the lazy backend on `loadNamespaces`.
 * `reloadResources` forces a backend read of the full merged desktopUi JSON.
 */
async function ensureFullDesktopUiLoaded(
	language: SupportedLanguage
): Promise<void> {
	await i18n.reloadResources(language, [DESKTOP_UI_NS]);
}

const desktopUiReadyByLanguage = new Map<SupportedLanguage, Promise<void>>();

/** Load full Desktop copy once for the currently active language. */
export function ensureDesktopUiReady(): Promise<void> {
	const language = normalizeSupportedLanguage(
		i18n.resolvedLanguage ?? i18n.language
	);
	const existing = desktopUiReadyByLanguage.get(language);
	if (existing) {
		return existing;
	}
	const task = ensureFullDesktopUiLoaded(language).catch((error: unknown) => {
		desktopUiReadyByLanguage.delete(language);
		throw error;
	});
	desktopUiReadyByLanguage.set(language, task);
	return task;
}

export const i18nReady = i18nInitPromise.then(async () => {
	const language = normalizeSupportedLanguage(
		i18n.resolvedLanguage ?? i18n.language
	);
	await ensureColdLanguageResources(language);
	i18n.on('languageChanged', (nextLanguage) => {
		const normalized = normalizeSupportedLanguage(nextLanguage);
		void ensureColdLanguageResources(normalized);
	});
});

export { mergeDesktopUiWithChrome };
export * from './namespaces';
export default i18n;
