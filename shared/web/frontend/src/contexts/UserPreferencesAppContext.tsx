/**
 * UserPreferencesAppContext
 * Loads user preferences (profile API) when authenticated and applies:
 * - Accessibility: data-* attributes on documentElement + CSS (high-contrast, large-text, reduce-motion)
 * - UI: exposes preferences.ui for consumers (compact_mode, animations_enabled, sidebar_collapsed, default_view)
 */

import * as React from 'react';
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { setNotificationPreferencesSnapshot } from '../notifications/prefsBridge';
import profileService, {
	PROFILE_PREFERENCES_QUERY_KEY,
} from '../services/profileService';
import { queryClient } from '../providers/QueryProvider';
import type { UserPreferences } from '../types/profile';
import { DESKTOP_SHELL_BOOTSTRAP_STALE_MS } from '../pages/Desktop/services/desktopShellQueryFreshness';
import {
	normalizeDesktopSourceEnabled,
	normalizeDesktopSoundTheme,
	normalizeDesktopSourceThemes,
	updateDesktopNotificationSettings,
} from '../pages/Desktop/utils/notificationSound';

export interface UserPreferencesAppContextValue {
	preferences: UserPreferences | null;
	loading: boolean;
	/**
	 * Without args: GET /preferences from server.
	 * With server response (e.g. from PATCH): apply immediately — no extra GET.
	 */
	refresh: (nextFromServer?: UserPreferences | null) => Promise<void>;
}

const UserPreferencesAppContext =
	createContext<UserPreferencesAppContextValue | null>(null);

export function useUserPreferencesApp(): UserPreferencesAppContextValue | null {
	return useContext(UserPreferencesAppContext);
}

/** Apply accessibility preferences to document (data-* attributes for CSS) */
function applyAccessibilityToDocument(prefs: UserPreferences | null): void {
	const root = document.documentElement;
	if (!prefs?.accessibility) {
		root.removeAttribute('data-accessibility-high-contrast');
		root.removeAttribute('data-accessibility-large-text');
		root.removeAttribute('data-accessibility-reduce-motion');
		root.removeAttribute('data-accessibility-screen-reader');
		root.removeAttribute('data-ui-compact-mode');
		root.removeAttribute('data-ui-animations-disabled');
		return;
	}
	const a = prefs.accessibility;
	if (a.high_contrast)
		root.setAttribute('data-accessibility-high-contrast', 'true');
	else root.removeAttribute('data-accessibility-high-contrast');
	if (a.large_text) root.setAttribute('data-accessibility-large-text', 'true');
	else root.removeAttribute('data-accessibility-large-text');
	if (a.reduce_motion)
		root.setAttribute('data-accessibility-reduce-motion', 'true');
	else root.removeAttribute('data-accessibility-reduce-motion');
	if (a.screen_reader)
		root.setAttribute('data-accessibility-screen-reader', 'true');
	else root.removeAttribute('data-accessibility-screen-reader');
	const ui = prefs.ui;
	if (ui?.compact_mode) root.setAttribute('data-ui-compact-mode', 'true');
	else root.removeAttribute('data-ui-compact-mode');
	if (ui && !ui.animations_enabled)
		root.setAttribute('data-ui-animations-disabled', 'true');
	else root.removeAttribute('data-ui-animations-disabled');
}

/** Sync profile notification prefs for in-app notify API + desktop sound module. */
function applyProfileNotificationChannel(prefs: UserPreferences | null): void {
	if (!prefs?.notifications) {
		setNotificationPreferencesSnapshot(null);
		updateDesktopNotificationSettings({
			soundEnabled: true,
			doNotDisturb: false,
			soundTheme: 'chime',
			soundThemeBySource: normalizeDesktopSourceThemes(null),
			soundEnabledBySource: normalizeDesktopSourceEnabled(null),
		});
		return;
	}
	const n = prefs.notifications;
	setNotificationPreferencesSnapshot(n);
	updateDesktopNotificationSettings({
		soundEnabled: n.desktop_sound_enabled ?? true,
		doNotDisturb: n.desktop_do_not_disturb ?? false,
		soundTheme: normalizeDesktopSoundTheme(n.desktop_sound_theme),
		soundThemeBySource: normalizeDesktopSourceThemes(
			n.desktop_sound_theme_by_source
		),
		soundEnabledBySource: normalizeDesktopSourceEnabled(
			n.desktop_sound_enabled_by_source
		),
	});
}

interface UserPreferencesAppProviderProps {
	children: ReactNode;
}

export function UserPreferencesAppProvider({
	children,
}: UserPreferencesAppProviderProps): React.JSX.Element {
	const { isAuthenticated } = useAuth();
	const [preferences, setPreferences] = useState<UserPreferences | null>(null);
	const [loading, setLoading] = useState(false);

	const load = useCallback(async () => {
		if (!isAuthenticated) {
			setPreferences(null);
			applyAccessibilityToDocument(null);
			applyProfileNotificationChannel(null);
			return;
		}
		setLoading(true);
		try {
			const { ensureDesktopShellBootstrap } = await import(
				'../pages/Desktop/services/desktopShellBootstrap'
			);
			await ensureDesktopShellBootstrap();
			const prefs = await queryClient.fetchQuery({
				queryKey: PROFILE_PREFERENCES_QUERY_KEY,
				queryFn: () => profileService.getPreferences(),
				staleTime: DESKTOP_SHELL_BOOTSTRAP_STALE_MS,
			});
			setPreferences(prefs);
			applyAccessibilityToDocument(prefs);
			applyProfileNotificationChannel(prefs);
		} catch {
			setPreferences(null);
			applyAccessibilityToDocument(null);
			applyProfileNotificationChannel(null);
		} finally {
			setLoading(false);
		}
	}, [isAuthenticated]);

	const refresh = useCallback(
		async (nextFromServer?: UserPreferences | null) => {
			if (nextFromServer) {
				setPreferences(nextFromServer);
				applyAccessibilityToDocument(nextFromServer);
				applyProfileNotificationChannel(nextFromServer);
				return;
			}
			await load();
		},
		[load]
	);

	useEffect(() => {
		if (!isAuthenticated) {
			setPreferences(null);
			applyAccessibilityToDocument(null);
			applyProfileNotificationChannel(null);
			return;
		}
		void load();
	}, [isAuthenticated, load]);

	const value: UserPreferencesAppContextValue = {
		preferences,
		loading,
		refresh,
	};

	return (
		<UserPreferencesAppContext.Provider value={value}>
			{children}
		</UserPreferencesAppContext.Provider>
	);
}
