/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract test for T35 voice commands + settings-center integration cluster wiring.
 *
 * Invariants:
 * - Integration outputs wire facade shell; voice commands defer to lazy runtime.
 *
 * Related:
 * - hooks/useDesktopWorkspaceVoiceSettingsCenterCluster.ts
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMinimalDesktopSettingsPanelProps } from '../../__fixtures__/desktopSettingsTestDoubles';
import type { DesktopWorkspaceVoiceSettingsCenterClusterInput } from '../../types/desktopWorkspaceVoiceSettingsCenterCluster.types';

const settingsCenterIntegration = vi.hoisted(() =>
	vi.fn(() => ({
		settingsCenterBridge: { sync: { isOnline: true } },
		workspaceProfilesShellContext: {
			windows: [],
			getWindowsOnDesktop: vi.fn(() => []),
			activeDesktopId: 'd1',
		},
		clearActiveDesktopWallpaperOverride: vi.fn(),
		onApplyUserVisualStylePreset: vi.fn(),
		onExportPersonalizationPackJson: vi.fn(() => ''),
		onImportPersonalizationPackJson: vi.fn(),
	}))
);
const voiceCommandsHook = vi.hoisted(() => vi.fn());
const surfaceChromeFacade = vi.hoisted(() =>
	vi.fn(() => ({
		shellClusterRest: { activeTab: 'personalize' },
		surfaceChromeBundleInput: { accentRgb: '1,2,3' },
	}))
);

vi.mock('../useDesktopWorkspaceSettingsCenterIntegration', () => ({
	useDesktopWorkspaceSettingsCenterIntegration: settingsCenterIntegration,
}));
vi.mock('../useDesktopVoiceCommands', () => ({
	useDesktopVoiceCommands: voiceCommandsHook,
}));
vi.mock('../useDesktopWorkspaceSettingsSurfaceChromeFacade', () => ({
	useDesktopWorkspaceSettingsSurfaceChromeFacade: surfaceChromeFacade,
}));

import { useDesktopWorkspaceVoiceSettingsCenterCluster } from '../useDesktopWorkspaceVoiceSettingsCenterCluster';

const minimalClusterInput =
	(): DesktopWorkspaceVoiceSettingsCenterClusterInput => {
		const panel = createMinimalDesktopSettingsPanelProps();
		const visualPreferences = panel as never;
		return {
			settingsCenter: {
				bridgeVirtualDesktops: {
					desktops: [{ id: 'd1', name: 'Main', wallpaper: '', isActive: true }],
					activeDesktopId: 'd1',
					wallpaper: '#111',
					createDesktop: vi.fn(),
					deleteDesktop: vi.fn(),
					switchToDesktop: vi.fn(),
					updateDesktopName: vi.fn(),
					updateDesktopWallpaper: vi.fn(),
				},
				bridgeSync: {
					tabConflictDetected: false,
					clearTabConflict: vi.fn(),
					isSyncing: false,
					storageError: null,
					isOnline: true,
					persistPatchStats: { config: 0, shell: 0, total: 0 },
					persistPatchFlushFailed: null,
					flushPersistPatches: vi.fn(),
					refreshStorage: vi.fn(async () => undefined),
				},
				bridgeAppsWindows: {
					expansionSettings: {} as never,
					installedApps: [],
					items: [],
					handlePinAppFromStartMenu: vi.fn(),
					deleteItem: vi.fn(),
					openAppStoreAsWindow: vi.fn(),
					getWindowsOnDesktop: vi.fn(() => []),
					currentDesktopWindows: [],
					bringWindowsIntoWorkArea: vi.fn(),
				},
				bridgeI18n: {
					t: ((key: string) => key) as never,
					clientLanguage: 'ru',
				},
				personalization: {
					config: null,
					desktopVisualPreferences: {} as never,
					deferVisualPersistRef: { current: false },
					actions: {
						setTheme: vi.fn(),
						setWallpaper: vi.fn(),
						setAccent: vi.fn(),
						setAccentCustomHex: vi.fn(),
					},
					updateConfig: vi.fn(),
					updateDesktopVisualPreferences: vi.fn(),
					updateDesktopWallpaper: vi.fn(),
					activeDesktopId: 'd1',
					persistSubjectForQueue: 'user-1',
				},
				workspaceProfiles: {
					windows: [],
					getWindowsOnDesktop: vi.fn(() => []),
					activeDesktopId: 'd1',
				},
			},
			surfaceChrome: {
				visual: {
					desktopVisualPreferences: visualPreferences,
					desktopWindowStyle: 'glass',
					accent: 'blue',
					accentCustomHex: '',
				},
				shellRest: {
					applyCuratedDesktopConfigPreset: panel.onApplyCuratedStyleSet,
					updateDesktopVisualPreferences: vi.fn(),
					updateConfig: vi.fn(),
					config: null,
					isOnline: panel.isOnline,
					isConfigSaving: panel.isConfigSaving,
					isProfileSaving: panel.isProfileSaving,
					configSaveError: panel.configSaveError,
					activeTab: panel.activeTab,
					onActiveTabChange: panel.onActiveTabChange,
					theme: panel.theme,
					onThemeChange: panel.onThemeChange,
					accent: panel.accent,
					accentCustomHex: panel.accentCustomHex,
					onAccentChange: panel.onAccentChange,
					onAccentCustomHexChange: panel.onAccentCustomHexChange,
					wallpaper: panel.wallpaper,
					iconSize: panel.iconSize,
					snapToGridEnabled: panel.snapToGrid,
					gridStep: panel.gridStep,
					desktopIconStyle: panel.desktopIconStyle,
					desktopTaskbarStyle: panel.desktopTaskbarStyle,
					desktopWindowStyle: panel.desktopWindowStyle,
					desktopFloatingWidgetVisible: panel.desktopFloatingWidgetVisible,
					desktopOpenAppsMaximized: panel.desktopOpenAppsMaximized,
					desktopUiScale: panel.desktopUiScale,
					expansionSettings: panel.expansionSettings,
					performance: panel.performance,
					profilePatchRemote: true,
					personalizationStagingActive: false,
					onPersonalizationStagingStart: vi.fn(),
					onPersonalizationStagingCommit: vi.fn(async () => undefined),
					onPersonalizationStagingCancel: vi.fn(),
				},
				appearance: {
					setShowWP: vi.fn(),
					updateConfig: vi.fn(),
					updateDesktopVisualPreferences: vi.fn(),
					clearPanelOpacityPersistTimer: vi.fn(),
					setDesktopVisualPreferences: vi.fn(),
					notifyDesktop: { error: vi.fn() },
					preferencesApp: null,
					withProfileUiSaveIndicator: vi.fn(async (fn: () => Promise<void>) =>
						fn()
					),
					serverUiPreferencesRef: { current: null as never },
					desktopVisualPreferencesRef: { current: visualPreferences },
					resolvedDesktopVisualPreferencesRef: { current: visualPreferences },
					panelOpacityPersistTimerRef: { current: null },
					deferProfilePersistRef: { current: false },
				},
				wallpaperRest: {
					createFolderAPI: vi.fn(),
					setWallpaper: vi.fn(),
					updateConfig: vi.fn(),
					deferConfigPersistRef: { current: false },
					wallpaper: '#111',
					wallpaperHistory: [],
				},
				mainSurfaceRest: {
					desktopAreaRef: { current: null },
					desktopThemeVars: {},
					effectiveTheme: 'dark' as const,
					storageLoading: false,
					parallaxDisabled: false,
					parallaxIntensityScale: 1,
					desktopFontBody: panel.desktopFontBody,
					desktopFontDisplay: panel.desktopFontDisplay,
					desktopSceneDepth: panel.desktopSceneDepth,
					wallpaperCrossfadeEnabled: panel.desktopWallpaperCrossfadeEnabled,
					styledTooltips: panel.desktopStyledTooltips,
				},
				virtualDesktop: {
					desktops: [
						{ id: 'd1', name: 'Main', wallpaper: 'vd-wall', isActive: true },
					],
					activeDesktopId: 'd1',
					wallpaper: '#111',
				},
			},
		};
	};

describe('useDesktopWorkspaceVoiceSettingsCenterCluster', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('merges bridge groups into settings-center integration', () => {
		const input = minimalClusterInput();
		renderHook(() => useDesktopWorkspaceVoiceSettingsCenterCluster(input));

		expect(settingsCenterIntegration).toHaveBeenCalledWith(
			expect.objectContaining({
				bridge: expect.objectContaining({
					desktops: input.settingsCenter.bridgeVirtualDesktops.desktops,
					clientLanguage: 'ru',
					expansionSettings:
						input.settingsCenter.bridgeAppsWindows.expansionSettings,
				}),
				personalization: input.settingsCenter.personalization,
				workspaceProfilesShellContext: input.settingsCenter.workspaceProfiles,
			})
		);
	});

	it('wires integration outputs into surface chrome facade without voice listeners', () => {
		const input = minimalClusterInput();
		renderHook(() => useDesktopWorkspaceVoiceSettingsCenterCluster(input));

		const integrationResult =
			settingsCenterIntegration.mock.results.at(-1)?.value;

		expect(voiceCommandsHook).not.toHaveBeenCalled();

		expect(surfaceChromeFacade).toHaveBeenCalledWith(
			expect.objectContaining({
				shell: expect.objectContaining({
					settingsCenterBridge: integrationResult?.settingsCenterBridge,
					onApplyUserVisualStylePreset:
						integrationResult?.onApplyUserVisualStylePreset,
					workspaceProfilesShellContext:
						integrationResult?.workspaceProfilesShellContext,
				}),
				chrome: expect.objectContaining({
					mainSurface: expect.objectContaining({
						wallpaper: 'vd-wall',
					}),
				}),
			})
		);
	});

	it('resolves active virtual desktop shell metadata', () => {
		const input = minimalClusterInput();
		const { result } = renderHook(() =>
			useDesktopWorkspaceVoiceSettingsCenterCluster(input)
		);

		expect(result.current.mainSurfaceWallpaper).toBe('vd-wall');
		expect(result.current.activeVirtualDesktopShell).toEqual({
			id: 'd1',
			name: 'Main',
		});
	});
});
