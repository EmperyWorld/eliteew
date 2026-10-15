/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * i18next backend that loads non-cold locale JSON on demand so idle `#desktop`
 * does not ship every product namespace in the entry `config-*.js` chunk.
 *
 * Invariants:
 * - Cold namespaces stay statically bundled in `config.ts` (ru).
 * - `read` is idempotent; concurrent loads for the same lng/ns coalesce.
 *
 * Related:
 * - `i18n/config.ts`, `i18n/namespaces.ts`
 */

import type { BackendModule, ReadCallback, Services } from 'i18next';
import { mergeDesktopUiWithChrome } from './mergeDesktopUiWithChrome';

type LocaleModule = { default: Record<string, unknown> };

type Loader = () => Promise<LocaleModule>;

async function loadMergedDesktopUi(
	language: 'ru' | 'en'
): Promise<LocaleModule> {
	if (language === 'ru') {
		const [ui, chrome] = await Promise.all([
			import('./locales/ru/desktopUi.json'),
			import('./locales/ru/desktopChrome.json'),
		]);
		return {
			default: mergeDesktopUiWithChrome(
				ui.default as Record<string, unknown>,
				chrome.default as Record<string, unknown>
			),
		};
	}
	const [ui, chrome] = await Promise.all([
		import('./locales/en/desktopUi.json'),
		import('./locales/en/desktopChrome.json'),
	]);
	return {
		default: mergeDesktopUiWithChrome(
			ui.default as Record<string, unknown>,
			chrome.default as Record<string, unknown>
		),
	};
}

const ruLoaders: Record<string, Loader> = {
	desktopUi: () => loadMergedDesktopUi('ru'),
	marketing: () => import('./locales/ru/marketing.json'),
	contentManager: () => import('./locales/ru/contentManager.json'),
	ugsHub: () => import('./locales/ru/ugsHub.json'),
	ugsAdmin: () => import('./locales/ru/ugsAdmin.json'),
	ugsAdminV2: () => import('./locales/ru/ugsAdminV2.json'),
	ugsAnalytics: () => import('./locales/ru/ugsAnalytics.json'),
	ugsDashboard: () => import('./locales/ru/ugsDashboard.json'),
	customerCabinet: () => import('./locales/ru/customerCabinet.json'),
	desktopAiChat: () => import('./locales/ru/desktopAiChat.json'),
	docEditorV2: () => import('./locales/ru/docEditorV2.json'),
	siteStudio: () => import('./locales/ru/siteStudio.json'),
	siteStudioCms: () => import('./locales/ru/siteStudioCms.json'),
	docEditorPanels: () => import('./locales/ru/docEditorPanels.json'),
	appStore: () => import('./locales/ru/appStore.json'),
	ultimateDocEditor: () => import('./locales/ru/ultimateDocEditor.json'),
	gafChat: () => import('./locales/ru/gafChat.json'),
	ewrp: () => import('./locales/ru/ewrp.json'),
	unifiedContentPicker: () => import('./locales/ru/unifiedContentPicker.json'),
	professionalWorlds: () => import('./locales/ru/professionalWorlds.json'),
	surveys: () => import('./locales/ru/surveys.json'),
	emperyNexusChronicle: () => import('./locales/ru/emperyNexusChronicle.json'),
	imageStudio: () => import('./locales/ru/imageStudio.json'),
};

const enLoaders: Record<string, Loader> = {
	commonUi: () => import('./locales/en/commonUi.json'),
	desktopUi: () => loadMergedDesktopUi('en'),
	desktopChrome: () => import('./locales/en/desktopChrome.json'),
	marketing: () => import('./locales/en/marketing.json'),
	contentManager: () => import('./locales/en/contentManager.json'),
	ugsHub: () => import('./locales/en/ugsHub.json'),
	ugsAdmin: () => import('./locales/en/ugsAdmin.json'),
	ugsAdminV2: () => import('./locales/en/ugsAdminV2.json'),
	ugsAnalytics: () => import('./locales/en/ugsAnalytics.json'),
	ugsDashboard: () => import('./locales/en/ugsDashboard.json'),
	customerCabinet: () => import('./locales/en/customerCabinet.json'),
	desktopAiChat: () => import('./locales/en/desktopAiChat.json'),
	docEditorV2: () => import('./locales/en/docEditorV2.json'),
	siteStudio: () => import('./locales/en/siteStudio.json'),
	siteStudioCms: () => import('./locales/en/siteStudioCms.json'),
	docEditorPanels: () => import('./locales/en/docEditorPanels.json'),
	appStore: () => import('./locales/en/appStore.json'),
	ultimateDocEditor: () => import('./locales/en/ultimateDocEditor.json'),
	gafChat: () => import('./locales/en/gafChat.json'),
	ewrp: () => import('./locales/en/ewrp.json'),
	unifiedContentPicker: () => import('./locales/en/unifiedContentPicker.json'),
	professionalWorlds: () => import('./locales/en/professionalWorlds.json'),
	surveys: () => import('./locales/en/surveys.json'),
	emperyNexusChronicle: () => import('./locales/en/emperyNexusChronicle.json'),
	imageStudio: () => import('./locales/en/imageStudio.json'),
};

const inflight = new Map<string, Promise<Record<string, unknown>>>();

function loadersFor(language: string): Record<string, Loader> | null {
	if (language === 'ru') return ruLoaders;
	if (language === 'en') return enLoaders;
	return null;
}

async function loadNamespacePayload(
	language: string,
	namespace: string
): Promise<Record<string, unknown>> {
	const key = `${language}:${namespace}`;
	const existing = inflight.get(key);
	if (existing) return existing;

	const loaders = loadersFor(language);
	const loader = loaders?.[namespace];
	if (!loader) {
		return Promise.reject(new Error(`No locale loader for ${key}`));
	}

	const promise = loader()
		.then((mod) => mod.default)
		.finally(() => {
			inflight.delete(key);
		});
	inflight.set(key, promise);
	return promise;
}

/**
 * i18next v23+ BackendModule: only `read` is required for on-demand namespace loads.
 */
export const eliteewLazyLocaleBackend: BackendModule = {
	type: 'backend',
	init(
		_services: Services,
		_backendOptions: unknown,
		_i18nextOptions: unknown
	) {
		/* no-op */
	},
	read(language: string, namespace: string, callback: ReadCallback) {
		void loadNamespacePayload(language, namespace)
			.then((data) => {
				callback(null, data);
			})
			.catch((err: unknown) => {
				callback(err instanceof Error ? err : new Error(String(err)), false);
			});
	},
};
