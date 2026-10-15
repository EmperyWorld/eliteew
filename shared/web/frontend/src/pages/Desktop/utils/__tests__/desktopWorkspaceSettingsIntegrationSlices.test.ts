/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 20 lock: visual + persistence Settings Integration slices compose into shellRest.
 *
 * Invariants:
 * - Staging active ⇒ profilePatchRemote false; bridgeSync carries persist queue stats.
 *
 * Related:
 * - utils/desktopWorkspaceSettingsIntegrationSlices.ts
 */

import { describe, expect, it, vi } from 'vitest';
import {
	buildDesktopWorkspaceSettingsPersistenceSlice,
	buildDesktopWorkspaceSettingsVisualSlice,
	mergeDesktopWorkspaceSettingsShellRest,
} from '../desktopWorkspaceSettingsIntegrationSlices';

describe('desktopWorkspaceSettingsIntegrationSlices (Wave 20)', () => {
	it('builds visual slice with accent + wallpaper history pass-through', () => {
		const deferRef = { current: false };
		const slice = buildDesktopWorkspaceSettingsVisualSlice({
			personalization: {
				desktopVisualPreferences: {
					desktop_font_body: 'body',
					desktop_font_display: 'display',
					desktop_scene_depth: 0.4,
					desktop_wallpaper_crossfade_enabled: true,
					desktop_styled_tooltips: true,
				} as never,
				updateDesktopVisualPreferences: vi.fn(),
				updateConfig: vi.fn(),
				config: { wallpaper_history: ['a', 'b'] } as never,
				deferVisualPersistRef: deferRef,
			},
			themeSurface: {
				desktopWindowStyle: 'flat',
				accent: 'blue',
				accentCustomHex: '',
				applyCuratedDesktopConfigPreset: vi.fn(),
				theme: 'dark',
				setTheme: vi.fn(),
				setAccentChoice: vi.fn(),
				onAccentCustomHexChange: vi.fn(),
				iconSize: 'medium',
				snapToGridEnabled: true,
				gridStep: 'medium',
				desktopIconStyle: 'minimal',
				desktopTaskbarStyle: 'flat',
				showDesktopWidget: true,
				desktopOpenAppsMaximized: false,
				desktopUiScale: 1,
				desktopThemeVars: { '--x': '1' },
				effectiveTheme: 'dark',
			},
			appearanceBridge: {
				setShowWP: vi.fn(),
				clearPanelOpacityPersistTimer: vi.fn(),
				setDesktopVisualPreferences: vi.fn(),
				notifyDesktop: { error: vi.fn() },
				preferencesApp: null,
				withProfileUiSaveIndicator: vi.fn(async (fn) => {
					await fn();
				}),
				serverUiPreferencesRef: { current: {} as never },
				desktopVisualPreferencesRef: { current: {} as never },
				resolvedDesktopVisualPreferencesRef: { current: {} as never },
				panelOpacityPersistTimerRef: { current: null },
			},
			wallpaperBridge: {
				createFolderAPI: vi.fn(),
				setWallpaper: vi.fn(),
			},
			mainSurface: {
				desktopAreaRef: { current: null },
				storageLoading: false,
				shellMotionPrefs: {
					parallaxEnabled: true,
					parallaxIntensityScale: 1,
				},
			},
			virtualDesktops: { wallpaper: '#abc' },
		});

		expect(slice.visual.accent).toBe('blue');
		expect(slice.shellVisual.wallpaper).toBe('#abc');
		expect(slice.wallpaperRest.wallpaperHistory).toEqual(['a', 'b']);
		expect(slice.mainSurfaceRest.parallaxDisabled).toBe(false);
		expect(slice.appearance.deferProfilePersistRef).toBe(deferRef);
	});

	it('builds persistence slice with staging gating profilePatchRemote', () => {
		const flush = vi.fn(async () => true);
		const slice = buildDesktopWorkspaceSettingsPersistenceSlice({
			storageAndPersist: {
				storage: {
					tabConflictDetected: false,
					clearTabConflict: vi.fn(),
					isSyncing: false,
					error: null,
					isOnline: true,
					refresh: vi.fn(),
					isConfigSaving: false,
					configSaveError: null,
				},
				persistPatchStats: { config: 1, shell: 2, total: 3 },
				persistPatchFlushFailed: null,
				flushPersistPatches: flush,
			},
			settingsPanel: {
				isProfileUiSaving: false,
				personalizationStagingActive: true,
				startPersonalizationStaging: vi.fn(),
				commitPersonalizationStaging: vi.fn(),
				cancelPersonalizationStaging: vi.fn(),
			},
		});

		expect(slice.bridgeSync.persistPatchStats.total).toBe(3);
		expect(slice.shellPersist.profilePatchRemote).toBe(false);
		expect(slice.shellPersist.personalizationStagingActive).toBe(true);
	});

	it('merges visual + persist + rest into one shellRest', () => {
		const shellRest = mergeDesktopWorkspaceSettingsShellRest({
			visual: {
				applyCuratedDesktopConfigPreset: vi.fn(),
				updateDesktopVisualPreferences: vi.fn(),
				updateConfig: vi.fn(),
				config: null,
				theme: 'dark',
				onThemeChange: vi.fn(),
				accent: 'blue',
				accentCustomHex: '',
				onAccentChange: vi.fn(),
				onAccentCustomHexChange: vi.fn(),
				wallpaper: '#000',
				iconSize: 'medium',
				snapToGridEnabled: true,
				gridStep: 'medium',
				desktopIconStyle: 'minimal',
				desktopTaskbarStyle: 'flat',
				desktopWindowStyle: 'flat',
				desktopFloatingWidgetVisible: true,
				desktopOpenAppsMaximized: false,
				desktopUiScale: 1,
			},
			persist: {
				isOnline: true,
				isConfigSaving: false,
				isProfileSaving: false,
				configSaveError: null,
				profilePatchRemote: true,
				personalizationStagingActive: false,
				onPersonalizationStagingStart: vi.fn(),
				onPersonalizationStagingCommit: vi.fn(),
				onPersonalizationStagingCancel: vi.fn(),
			},
			rest: {
				activeTab: 'personalize',
				onActiveTabChange: vi.fn(),
				expansionSettings: {} as never,
				performance: {} as never,
			},
		});

		expect(shellRest.activeTab).toBe('personalize');
		expect(shellRest.accent).toBe('blue');
		expect(shellRest.isOnline).toBe(true);
		expect(shellRest.profilePatchRemote).toBe(true);
	});
});
