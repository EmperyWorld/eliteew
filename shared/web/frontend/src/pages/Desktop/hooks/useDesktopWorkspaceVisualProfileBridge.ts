/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop visual preference bridge: icon/taskbar/window style, wallpaper motion,
 * and persist-to-profile. Badge/unread counts live in the deferred extras runtime.
 *
 * Invariants:
 * - Does not import friends, GAF unread, EWDesk, or folder-library network hooks.
 *
 * Related:
 * - useDesktopWorkspaceShellBadgeCounts.ts
 * - documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import profileService from '../../../services/profileService';
import type { UIPreferences } from '../../../types/profile';
import {
	clampDesktopPanelOpacity,
	DEFAULT_UI_PREFERENCES,
	normalizeDesktopIconStyle,
	normalizeDesktopTaskbarStyle,
	normalizeDesktopWidgetsStyle,
	normalizeDesktopFontBody,
	normalizeDesktopFontDisplay,
	normalizeDesktopSceneDepth,
	normalizeDesktopShellMotionSpeed,
	normalizeDesktopShellParallaxIntensity,
} from '../../../types/profile';
import { log } from '../../../utils/logger';
import type { UserPreferencesAppContextValue } from '../../../contexts/UserPreferencesAppContext';
import { isPersistentDesktopApp } from '../constants';
import type { WindowState } from '../types/desktop.types';
import { clampDesktopUiScale } from '../utils/desktopUiScale';

/** Keep widget in low-frequency mode briefly after drag frame bursts. */
const WINDOW_DRAG_WIDGET_DEFER_MS = 240;

export type DesktopWorkspaceVisualPreferenceState = Pick<
	UIPreferences,
	| 'desktop_open_apps_maximized'
	| 'desktop_floating_widget_visible'
	| 'desktop_icon_style'
	| 'desktop_scene_depth'
	| 'desktop_font_body'
	| 'desktop_font_display'
	| 'desktop_wallpaper_crossfade_enabled'
	| 'desktop_styled_tooltips'
	| 'desktop_shell_reduce_motion'
	| 'desktop_shell_parallax_enabled'
	| 'desktop_shell_parallax_intensity'
	| 'desktop_shell_window_morph_enabled'
	| 'desktop_shell_motion_speed'
	| 'desktop_taskbar_style'
	| 'desktop_window_style'
	| 'desktop_accent_follows_window_style'
	| 'desktop_widgets_style'
	| 'desktop_panel_opacity'
	| 'desktop_ui_scale'
	| 'desktop_reduce_backdrop_blur'
>;

export type DesktopVisualPreferencePersistOptions = {
	/** Default true. False: update local shell state only (no profile PATCH). */
	persist?: boolean;
};

export function useDesktopWorkspaceVisualProfileBridge(params: {
	preferencesApp: UserPreferencesAppContextValue | null;
	notifyDesktop: { error: (title: string, message: string) => void };
}) {
	const { preferencesApp, notifyDesktop } = params;
	const { t } = useTranslation('desktopUi');

	const serverUiPreferences = useMemo<UIPreferences>(() => {
		const merged: UIPreferences = {
			...DEFAULT_UI_PREFERENCES,
			...(preferencesApp?.preferences?.ui ?? {}),
		};
		return {
			...merged,
			desktop_icon_style: normalizeDesktopIconStyle(
				merged.desktop_icon_style as string | undefined
			),
			desktop_taskbar_style: normalizeDesktopTaskbarStyle(
				merged.desktop_taskbar_style as string | undefined
			),
			desktop_widgets_style: normalizeDesktopWidgetsStyle(
				merged.desktop_widgets_style as string | undefined
			),
			desktop_panel_opacity: clampDesktopPanelOpacity(
				merged.desktop_panel_opacity
			),
			desktop_ui_scale: clampDesktopUiScale(merged.desktop_ui_scale),
			desktop_accent_follows_window_style:
				merged.desktop_accent_follows_window_style === true,
			desktop_reduce_backdrop_blur:
				merged.desktop_reduce_backdrop_blur === true,
			desktop_scene_depth: normalizeDesktopSceneDepth(
				merged.desktop_scene_depth as string | undefined
			),
			desktop_font_body: normalizeDesktopFontBody(
				merged.desktop_font_body as string | undefined
			),
			desktop_font_display: normalizeDesktopFontDisplay(
				merged.desktop_font_display as string | undefined
			),
			desktop_wallpaper_crossfade_enabled:
				merged.desktop_wallpaper_crossfade_enabled !== false,
			desktop_styled_tooltips: merged.desktop_styled_tooltips !== false,
			desktop_shell_reduce_motion: merged.desktop_shell_reduce_motion === true,
			desktop_shell_parallax_enabled:
				merged.desktop_shell_parallax_enabled !== false,
			desktop_shell_parallax_intensity: normalizeDesktopShellParallaxIntensity(
				merged.desktop_shell_parallax_intensity as string | undefined
			),
			desktop_shell_window_morph_enabled:
				merged.desktop_shell_window_morph_enabled !== false,
			desktop_shell_motion_speed: normalizeDesktopShellMotionSpeed(
				merged.desktop_shell_motion_speed as string | undefined
			),
		};
	}, [preferencesApp?.preferences?.ui]);

	const resolvedDesktopVisualPreferences =
		useMemo<DesktopWorkspaceVisualPreferenceState>(
			() => ({
				desktop_open_apps_maximized:
					serverUiPreferences.desktop_open_apps_maximized,
				desktop_floating_widget_visible:
					serverUiPreferences.desktop_floating_widget_visible,
				desktop_icon_style: serverUiPreferences.desktop_icon_style,
				desktop_scene_depth: serverUiPreferences.desktop_scene_depth,
				desktop_font_body: serverUiPreferences.desktop_font_body,
				desktop_font_display: serverUiPreferences.desktop_font_display,
				desktop_wallpaper_crossfade_enabled:
					serverUiPreferences.desktop_wallpaper_crossfade_enabled,
				desktop_styled_tooltips: serverUiPreferences.desktop_styled_tooltips,
				desktop_shell_reduce_motion:
					serverUiPreferences.desktop_shell_reduce_motion,
				desktop_shell_parallax_enabled:
					serverUiPreferences.desktop_shell_parallax_enabled,
				desktop_shell_parallax_intensity:
					serverUiPreferences.desktop_shell_parallax_intensity,
				desktop_shell_window_morph_enabled:
					serverUiPreferences.desktop_shell_window_morph_enabled,
				desktop_shell_motion_speed:
					serverUiPreferences.desktop_shell_motion_speed,
				desktop_taskbar_style: serverUiPreferences.desktop_taskbar_style,
				desktop_window_style: serverUiPreferences.desktop_window_style,
				desktop_accent_follows_window_style:
					serverUiPreferences.desktop_accent_follows_window_style,
				desktop_widgets_style: serverUiPreferences.desktop_widgets_style,
				desktop_panel_opacity: serverUiPreferences.desktop_panel_opacity,
				desktop_ui_scale: serverUiPreferences.desktop_ui_scale,
				desktop_reduce_backdrop_blur:
					serverUiPreferences.desktop_reduce_backdrop_blur,
			}),
			[
				serverUiPreferences.desktop_open_apps_maximized,
				serverUiPreferences.desktop_floating_widget_visible,
				serverUiPreferences.desktop_icon_style,
				serverUiPreferences.desktop_scene_depth,
				serverUiPreferences.desktop_font_body,
				serverUiPreferences.desktop_font_display,
				serverUiPreferences.desktop_wallpaper_crossfade_enabled,
				serverUiPreferences.desktop_styled_tooltips,
				serverUiPreferences.desktop_shell_reduce_motion,
				serverUiPreferences.desktop_shell_parallax_enabled,
				serverUiPreferences.desktop_shell_parallax_intensity,
				serverUiPreferences.desktop_shell_window_morph_enabled,
				serverUiPreferences.desktop_shell_motion_speed,
				serverUiPreferences.desktop_taskbar_style,
				serverUiPreferences.desktop_window_style,
				serverUiPreferences.desktop_accent_follows_window_style,
				serverUiPreferences.desktop_widgets_style,
				serverUiPreferences.desktop_panel_opacity,
				serverUiPreferences.desktop_ui_scale,
				serverUiPreferences.desktop_reduce_backdrop_blur,
			]
		);

	const [desktopVisualPreferences, setDesktopVisualPreferences] =
		useState<DesktopWorkspaceVisualPreferenceState>(
			resolvedDesktopVisualPreferences
		);
	const serverUiPreferencesRef = useRef(serverUiPreferences);
	const desktopVisualPreferencesRef = useRef(desktopVisualPreferences);
	const resolvedDesktopVisualPreferencesRef = useRef(
		resolvedDesktopVisualPreferences
	);
	const panelOpacityPersistTimerRef = useRef<number | null>(null);
	const profileUiSaveInFlightRef = useRef(0);
	const [isProfileUiSaving, setIsProfileUiSaving] = useState(false);

	const isWindowDragActiveRef = useRef(false);
	const windowDragWidgetTimerRef = useRef<number | null>(null);
	const [isWindowDragActive, setIsWindowDragActive] = useState(false);

	const withProfileUiSaveIndicator = useCallback(
		async (fn: () => Promise<void>) => {
			profileUiSaveInFlightRef.current += 1;
			setIsProfileUiSaving(true);
			try {
				await fn();
			} finally {
				profileUiSaveInFlightRef.current -= 1;
				if (profileUiSaveInFlightRef.current <= 0) {
					profileUiSaveInFlightRef.current = 0;
					setIsProfileUiSaving(false);
				}
			}
		},
		[]
	);

	useEffect(() => {
		setDesktopVisualPreferences(resolvedDesktopVisualPreferences);
	}, [resolvedDesktopVisualPreferences]);

	useEffect(() => {
		serverUiPreferencesRef.current = serverUiPreferences;
	}, [serverUiPreferences]);
	useEffect(() => {
		desktopVisualPreferencesRef.current = desktopVisualPreferences;
	}, [desktopVisualPreferences]);
	useEffect(() => {
		resolvedDesktopVisualPreferencesRef.current =
			resolvedDesktopVisualPreferences;
	}, [resolvedDesktopVisualPreferences]);
	useEffect(() => {
		return () => {
			if (panelOpacityPersistTimerRef.current) {
				clearTimeout(panelOpacityPersistTimerRef.current);
				panelOpacityPersistTimerRef.current = null;
			}
		};
	}, []);

	const clearPanelOpacityPersistTimer = useCallback(() => {
		if (panelOpacityPersistTimerRef.current) {
			clearTimeout(panelOpacityPersistTimerRef.current);
			panelOpacityPersistTimerRef.current = null;
		}
	}, []);
	const clearWindowDragWidgetTimer = useCallback(() => {
		if (windowDragWidgetTimerRef.current != null) {
			window.clearTimeout(windowDragWidgetTimerRef.current);
			windowDragWidgetTimerRef.current = null;
		}
	}, []);

	const updateDesktopVisualPreferences = useCallback(
		async (
			updates: Partial<DesktopWorkspaceVisualPreferenceState>,
			options?: DesktopVisualPreferencePersistOptions
		) => {
			clearPanelOpacityPersistTimer();
			const nextUi: UIPreferences = {
				...serverUiPreferences,
				...desktopVisualPreferences,
				...updates,
			};
			setDesktopVisualPreferences((prev) => ({ ...prev, ...updates }));
			const persist = options?.persist !== false;
			if (!persist) {
				return;
			}
			await withProfileUiSaveIndicator(async () => {
				try {
					const updated = await profileService.updatePreferences({
						ui: nextUi,
					});
					await preferencesApp?.refresh?.(updated);
				} catch (error) {
					setDesktopVisualPreferences(resolvedDesktopVisualPreferences);
					log.error(
						'Desktop',
						'Failed to persist desktop visual preferences',
						error instanceof Error ? error : undefined
					);
					notifyDesktop.error(
						t('shortcuts.profileSaveFailedTitle'),
						t('shortcuts.profileSaveFailedBody')
					);
				}
			});
		},
		[
			clearPanelOpacityPersistTimer,
			desktopVisualPreferences,
			notifyDesktop,
			t,
			preferencesApp,
			resolvedDesktopVisualPreferences,
			serverUiPreferences,
			withProfileUiSaveIndicator,
		]
	);

	const markWindowDragActivity = useCallback(() => {
		if (!isWindowDragActiveRef.current) {
			isWindowDragActiveRef.current = true;
			setIsWindowDragActive(true);
		}
		clearWindowDragWidgetTimer();
		windowDragWidgetTimerRef.current = window.setTimeout(() => {
			windowDragWidgetTimerRef.current = null;
			if (!isWindowDragActiveRef.current) return;
			isWindowDragActiveRef.current = false;
			setIsWindowDragActive(false);
		}, WINDOW_DRAG_WIDGET_DEFER_MS);
	}, [clearWindowDragWidgetTimer]);

	const showDesktopWidget =
		desktopVisualPreferences.desktop_floating_widget_visible;
	const desktopIconStyle = desktopVisualPreferences.desktop_icon_style;
	const desktopTaskbarStyle = desktopVisualPreferences.desktop_taskbar_style;
	const desktopWindowStyle = desktopVisualPreferences.desktop_window_style;
	const desktopUiScale = desktopVisualPreferences.desktop_ui_scale;
	const desktopOpenAppsMaximized =
		desktopVisualPreferences.desktop_open_apps_maximized;

	return {
		serverUiPreferences,
		resolvedDesktopVisualPreferences,
		desktopVisualPreferences,
		setDesktopVisualPreferences,
		serverUiPreferencesRef,
		desktopVisualPreferencesRef,
		resolvedDesktopVisualPreferencesRef,
		panelOpacityPersistTimerRef,
		isProfileUiSaving,
		withProfileUiSaveIndicator,
		clearPanelOpacityPersistTimer,
		clearWindowDragWidgetTimer,
		updateDesktopVisualPreferences,
		markWindowDragActivity,
		isWindowDragActive,
		setIsWindowDragActive,
		isWindowDragActiveRef,
		windowDragWidgetTimerRef,
		showDesktopWidget,
		desktopIconStyle,
		desktopTaskbarStyle,
		desktopWindowStyle,
		desktopUiScale,
		desktopOpenAppsMaximized,
	};
}

export function useMinimizedPersistentSurfaceApps(windows: WindowState[]) {
	return useMemo(() => {
		const next = new Set<string>();
		for (const w of windows) {
			if (w.type !== 'app' || !w.appComponent) continue;
			if (!isPersistentDesktopApp(w.appComponent)) continue;
			if (w.isMinimized || w.isMinimizing) next.add(w.appComponent);
		}
		return next;
	}, [windows]);
}
