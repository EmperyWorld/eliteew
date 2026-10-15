import type { ThemeId } from '@constants/themePresets';
import { ADMIN_THEME_STORAGE_KEY } from '@services/api/authStorage';
import { adminApiClient } from '@services/api/client';
import { useSiteSettingsStore } from '@store/slices/siteSettingsSlice';
import { applyThemeVariables } from '@utils/themeUtils';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AdminTheme = 'light' | 'dark' | 'system' | 'site';

interface AdminThemeState {
	theme: AdminTheme;
	resolvedTheme: 'light' | 'dark';
	isLoading: boolean;
	_hasHydrated: boolean;
	setTheme: (theme: AdminTheme) => Promise<void>;
	initTheme: () => Promise<void>;
}

function getSystemTheme(): 'light' | 'dark' {
	if (typeof window === 'undefined') return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches
		? 'dark'
		: 'light';
}

function applyResolvedTheme(theme: 'light' | 'dark') {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	root.classList.toggle('dark', theme === 'dark');
	root.classList.toggle('light', theme === 'light');
}

async function resolveTheme(theme: AdminTheme): Promise<'light' | 'dark'> {
	if (theme === 'system') {
		return getSystemTheme();
	}
	if (theme === 'site') {
		const store = useSiteSettingsStore.getState();
		if (!store.settingsLoaded) {
			await store.loadSettings();
		}
		const siteThemeId =
			(useSiteSettingsStore.getState().siteSettings?.defaultTheme as ThemeId) ||
			'verdant-aurora';
		applyThemeVariables(siteThemeId);
		return 'light';
	}
	return theme;
}

export const useAdminTheme = create<AdminThemeState>()(
	persist(
		(set, get) => ({
			theme: 'light',
			resolvedTheme: 'light',
			isLoading: false,
			_hasHydrated: false,

			setTheme: async (theme: AdminTheme) => {
				const resolvedTheme = await resolveTheme(theme);
				applyResolvedTheme(resolvedTheme);
				set({ theme, resolvedTheme, isLoading: true });
				try {
					await adminApiClient.put('/admin/config', {
						namespace: 'site',
						key: 'adminTheme',
						type: 'string',
						value: theme,
					});
				} finally {
					set({ isLoading: false });
				}
			},

			initTheme: async () => {
				const theme = get().theme;
				const resolvedTheme = await resolveTheme(theme);
				set({ resolvedTheme });
				applyResolvedTheme(resolvedTheme);
			},
		}),
		{
			name: ADMIN_THEME_STORAGE_KEY,
			partialize: (state) => ({ theme: state.theme }),
			onRehydrateStorage: () => (state) => {
				if (state) {
					state._hasHydrated = true;
				}
			},
		}
	)
);
