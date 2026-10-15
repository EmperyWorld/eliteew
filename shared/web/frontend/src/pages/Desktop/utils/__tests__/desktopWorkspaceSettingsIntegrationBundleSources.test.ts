/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 21 lock: flat TailCluster locals → Settings Integration Bundle sources.
 *
 * Invariants:
 * - Nullish iconSize/gridStep become `'medium'`.
 * - Eleven source groups are present for Bundle/ClusterInput.
 *
 * Related:
 * - utils/desktopWorkspaceSettingsIntegrationBundleSources.ts
 */

import { describe, expect, it, vi } from 'vitest';
import {
	buildDesktopWorkspaceSettingsIntegrationBundleSources,
	buildDesktopWorkspaceSettingsIntegrationBundleSourcesFromHead,
} from '../desktopWorkspaceSettingsIntegrationBundleSources';
import type { DesktopWorkspaceSettingsIntegrationBundleFlatInput } from '../desktopWorkspaceSettingsIntegrationBundleSources';

function minimalFlat(
	overrides: Partial<DesktopWorkspaceSettingsIntegrationBundleFlatInput> = {}
): DesktopWorkspaceSettingsIntegrationBundleFlatInput {
	return {
		desktops: [{ id: 'd1', name: 'Main', wallpaper: '', isActive: true }],
		activeDesktopId: 'd1',
		wallpaper: '#111',
		createDesktop: vi.fn(),
		deleteDesktop: vi.fn(),
		switchToDesktop: vi.fn(),
		updateDesktopName: vi.fn(),
		updateDesktopWallpaper: vi.fn(),
		storage: {
			isOnline: true,
			isSyncing: false,
			error: null,
			tabConflictDetected: false,
			clearTabConflict: vi.fn(),
			refresh: vi.fn(),
			isConfigSaving: false,
			configSaveError: null,
		},
		persistPatchStats: { config: 0, shell: 0, total: 0 },
		persistPatchFlushFailed: null,
		flushPersistPatches: vi.fn(),
		expansionSettings: {} as never,
		installedApps: [],
		items: [],
		handlePinAppFromStartMenu: vi.fn(),
		openAppStoreAsWindow: vi.fn(),
		deleteItem: vi.fn(),
		windows: [],
		getWindowsOnDesktop: vi.fn(() => []),
		currentDesktopWindows: [],
		bringWindowsIntoWorkArea: vi.fn(),
		focusWindow: vi.fn(),
		closeWindow: vi.fn(),
		minimizeAllWindows: vi.fn(),
		closeActiveDesktopWindow: vi.fn(),
		activeDesktopWindowId: null,
		handleOpenWindow: vi.fn(),
		setShowNF: vi.fn(),
		setShowCommandPalette: vi.fn(),
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
		persistSubjectForQueue: null,
		t: vi.fn() as never,
		clientLanguage: 'en',
		theme: 'dark',
		setTheme: vi.fn(),
		effectiveTheme: 'dark',
		desktopThemeVars: {},
		accent: 'blue' as never,
		accentCustomHex: '',
		setAccentChoice: vi.fn(),
		onAccentCustomHexChange: vi.fn(),
		applyCuratedDesktopConfigPreset: vi.fn(),
		iconSize: null,
		snapToGridEnabled: true,
		gridStep: undefined,
		desktopIconStyle: 'minimal' as never,
		desktopTaskbarStyle: 'flat' as never,
		desktopWindowStyle: 'flat' as never,
		showDesktopWidget: true,
		desktopOpenAppsMaximized: false,
		desktopUiScale: 1,
		desktopSettingsActiveTab: 'personalize',
		setDesktopSettingsActiveTab: vi.fn(),
		mergedSettingsPerformanceForPanel: {} as never,
		personalizationStagingActive: false,
		startPersonalizationStaging: vi.fn(),
		commitPersonalizationStaging: vi.fn(),
		cancelPersonalizationStaging: vi.fn(),
		isProfileUiSaving: false,
		setShowWP: vi.fn(),
		preferencesApp: null,
		notifyDesktop: { error: vi.fn() },
		withProfileUiSaveIndicator: vi.fn(async (fn) => {
			await fn();
		}),
		clearPanelOpacityPersistTimer: vi.fn(),
		setDesktopVisualPreferences: vi.fn(),
		serverUiPreferencesRef: { current: {} as never },
		desktopVisualPreferencesRef: { current: {} as never },
		resolvedDesktopVisualPreferencesRef: { current: {} as never },
		panelOpacityPersistTimerRef: { current: null },
		createFolderAPI: vi.fn(),
		setWallpaper: vi.fn(),
		desktopAreaRef: { current: null },
		storageLoading: false,
		shellMotionPrefs: {
			parallaxEnabled: true,
			parallaxIntensityScale: 1,
		} as never,
		...overrides,
	};
}

describe('buildDesktopWorkspaceSettingsIntegrationBundleSources (Wave 21)', () => {
	it('defaults nullish iconSize/gridStep to medium', () => {
		const sources = buildDesktopWorkspaceSettingsIntegrationBundleSources(
			minimalFlat()
		);
		expect(sources.themeSurface.iconSize).toBe('medium');
		expect(sources.themeSurface.gridStep).toBe('medium');
	});

	it('preserves explicit iconSize/gridStep and nests eleven groups', () => {
		const pin = vi.fn();
		const sources = buildDesktopWorkspaceSettingsIntegrationBundleSources(
			minimalFlat({
				iconSize: 'large',
				gridStep: 'small',
				handlePinAppFromStartMenu: pin,
				clientLanguage: 'ru',
			})
		);

		expect(sources.themeSurface.iconSize).toBe('large');
		expect(sources.themeSurface.gridStep).toBe('small');
		expect(sources.expansionLaunch.handlePinAppFromStartMenu).toBe(pin);
		expect(sources.i18n.clientLanguage).toBe('ru');
		expect(Object.keys(sources).sort()).toEqual(
			[
				'appearanceBridge',
				'expansionLaunch',
				'i18n',
				'mainSurface',
				'personalization',
				'settingsPanel',
				'storageAndPersist',
				'themeSurface',
				'virtualDesktops',
				'wallpaperBridge',
				'windowsAndVoice',
			].sort()
		);
	});

	it('FromHead maps i18next language and launch pin/open handlers', () => {
		const pin = vi.fn();
		const openStore = vi.fn();
		const flat = minimalFlat({ clientLanguage: 'en' });
		const {
			clientLanguage: _ignored,
			handlePinAppFromStartMenu: _p,
			openAppStoreAsWindow: _o,
			...headRest
		} = flat;
		const sources =
			buildDesktopWorkspaceSettingsIntegrationBundleSourcesFromHead(
				{
					...headRest,
					i18nextInstance: { language: 'ru' },
				},
				{
					handlePinAppFromStartMenu: pin,
					openAppStoreAsWindow: openStore,
				}
			);

		expect(sources.i18n.clientLanguage).toBe('ru');
		expect(sources.expansionLaunch.handlePinAppFromStartMenu).toBe(pin);
		expect(sources.expansionLaunch.openAppStoreAsWindow).toBe(openStore);
	});
});
