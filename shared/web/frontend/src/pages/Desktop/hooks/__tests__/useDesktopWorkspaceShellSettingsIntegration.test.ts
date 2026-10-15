import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { DESKTOP_CURATED_STYLE_SETS } from '../../constants/desktopCuratedStyleSets';
import { STATIC_DESKTOP_SETTINGS_PERFORMANCE } from '../../utils/desktopWorkspacePerformanceConstants';
import {
	createMinimalDesktopShellStylesBridge,
	MINIMAL_DESKTOP_EXPANSION_SETTINGS,
	MINIMAL_DESKTOP_SETTINGS_CENTER,
} from '../../__fixtures__/desktopSettingsTestDoubles';
import { useDesktopWorkspaceShellSettingsIntegration } from '../useDesktopWorkspaceShellSettingsIntegration';

describe('useDesktopWorkspaceShellSettingsIntegration', () => {
	it('wires curated preset into bridge without throwing', async () => {
		const applyCuratedDesktopConfigPreset = vi.fn();
		const updateDesktopVisualPreferences = vi.fn(async () => {
			/* noop */
		});

		const set = DESKTOP_CURATED_STYLE_SETS[0];

		const { result } = renderHook(() =>
			useDesktopWorkspaceShellSettingsIntegration({
				applyCuratedDesktopConfigPreset,
				updateDesktopVisualPreferences,
				persistence: {
					isOnline: true,
					isConfigSaving: false,
					isProfileSaving: false,
					configSaveError: null,
				},
				session: {
					activeTab: 'personalize',
					onActiveTabChange: vi.fn(),
				},
				themeAccent: {
					theme: 'dark',
					onThemeChange: vi.fn(),
					accent: 'blue',
					accentCustomHex: '',
					onAccentChange: vi.fn(),
					onAccentCustomHexChange: vi.fn(),
				},
				wallpaperGrid: {
					wallpaper: '#000',
					onWallpaperChange: vi.fn(),
					onOpenWallpaperPicker: vi.fn(),
					iconSize: 'medium',
					onIconSizeChange: vi.fn(),
					snapToGrid: true,
					onSnapToGridChange: vi.fn(),
					gridStep: 'small',
					onGridStepChange: vi.fn(),
				},
				desktopShellStyles: createMinimalDesktopShellStylesBridge(),
				performance: {
					performance: STATIC_DESKTOP_SETTINGS_PERFORMANCE,
				},
				expansion: {
					expansionSettings: MINIMAL_DESKTOP_EXPANSION_SETTINGS,
				},
				settingsCenterBridge: MINIMAL_DESKTOP_SETTINGS_CENTER,
			})
		);

		await result.current.onApplyCuratedStyleSet?.(set);

		expect(updateDesktopVisualPreferences).toHaveBeenCalledWith(
			{
				desktop_accent_follows_window_style: set.accentFollows,
				desktop_window_style: set.windowStyle,
				desktop_taskbar_style: set.taskbarStyle ?? set.windowStyle,
				desktop_icon_style: set.iconStyle ?? set.windowStyle,
				desktop_widgets_style: set.widgetsStyle ?? set.windowStyle,
				desktop_font_body: set.fontBody,
				desktop_font_display: set.fontDisplay,
				desktop_scene_depth: set.sceneDepth,
			},
			{ persist: true }
		);
		expect(applyCuratedDesktopConfigPreset).toHaveBeenCalledWith(set);
	});
});
