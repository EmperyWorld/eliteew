import {
	DEFAULT_SITE_SETTINGS,
	resolveSiteSettings,
} from '@constants/siteDefaults';
import {
	fetchPublicSiteSettings,
	saveSiteSettings,
} from '@services/api/siteSettings';
import type { SiteSettings } from '@typings/admin';
import { create } from 'zustand';

interface SiteSettingsState {
	siteSettings: SiteSettings;
	settingsLoaded: boolean;
	settingsLoading: boolean;
	loadSettings: (force?: boolean) => Promise<void>;
	updateSiteSettings: (
		settings: Partial<SiteSettings>
	) => Promise<SiteSettings>;
	setSiteSettings: (settings: SiteSettings) => void;
}

let pendingLoad: Promise<void> | null = null;

export const useSiteSettingsStore = create<SiteSettingsState>()((set, get) => ({
	siteSettings: DEFAULT_SITE_SETTINGS,
	settingsLoaded: false,
	settingsLoading: false,

	loadSettings: async (force = false) => {
		const { settingsLoaded } = get();

		if (settingsLoaded && !force) {
			return;
		}

		if (pendingLoad && !force) {
			return pendingLoad;
		}

		pendingLoad = (async () => {
			set({ settingsLoading: true });

			try {
				const siteSettings = await fetchPublicSiteSettings();
				set({
					siteSettings,
					settingsLoaded: true,
					settingsLoading: false,
				});
			} catch {
				set({
					siteSettings: resolveSiteSettings(DEFAULT_SITE_SETTINGS),
					settingsLoaded: true,
					settingsLoading: false,
				});
			} finally {
				pendingLoad = null;
			}
		})();

		return pendingLoad;
	},

	updateSiteSettings: async (settings) => {
		const siteSettings = await saveSiteSettings(settings);
		set({ siteSettings, settingsLoaded: true });
		return siteSettings;
	},

	setSiteSettings: (siteSettings) => {
		set({
			siteSettings: resolveSiteSettings(siteSettings),
			settingsLoaded: true,
		});
	},
}));

export const ensureSiteSettingsLoaded = () =>
	useSiteSettingsStore.getState().loadSettings();
