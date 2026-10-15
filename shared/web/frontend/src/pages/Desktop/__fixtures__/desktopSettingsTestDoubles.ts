/**
 * Shared minimal shapes for DesktopSettingsPanel and shell integration tests.
 */

import type { DesktopSettingsPanelProps } from '../components/DesktopSettingsPanel';
import type { DesktopShellSettingsBridgeValue } from '../context/DesktopShellSettingsBridgeContext';
import type { DesktopExpansionSettings } from '../types/desktopExpansion.types';
import type { DesktopSettingsCenterBridge } from '../types/desktopSettingsCenterBridge.types';
import { STATIC_DESKTOP_SETTINGS_PERFORMANCE } from '../utils/desktopWorkspacePerformanceConstants';

type DesktopShellStylesBridge = Pick<
	DesktopShellSettingsBridgeValue,
	| 'desktopIconStyle'
	| 'onDesktopIconStyleChange'
	| 'desktopTaskbarStyle'
	| 'onDesktopTaskbarStyleChange'
	| 'desktopWindowStyle'
	| 'onDesktopWindowStyleChange'
	| 'desktopAccentFollowsWindowStyle'
	| 'onDesktopAccentFollowsWindowStyleChange'
	| 'desktopFloatingWidgetVisible'
	| 'onDesktopFloatingWidgetVisibleChange'
	| 'desktopOpenAppsMaximized'
	| 'onDesktopOpenAppsMaximizedChange'
	| 'desktopWidgetsStyle'
	| 'onDesktopWidgetsStyleChange'
	| 'desktopPanelOpacity'
	| 'onDesktopPanelOpacityChange'
	| 'desktopUiScale'
	| 'onDesktopUiScaleChange'
	| 'desktopSceneDepth'
	| 'onDesktopSceneDepthChange'
	| 'desktopFontBody'
	| 'onDesktopFontBodyChange'
	| 'desktopFontDisplay'
	| 'onDesktopFontDisplayChange'
	| 'desktopWallpaperCrossfadeEnabled'
	| 'onDesktopWallpaperCrossfadeChange'
	| 'desktopStyledTooltips'
	| 'onDesktopStyledTooltipsChange'
	| 'desktopShellReduceMotion'
	| 'onDesktopShellReduceMotionChange'
	| 'desktopShellParallaxEnabled'
	| 'onDesktopShellParallaxEnabledChange'
	| 'desktopShellParallaxIntensity'
	| 'onDesktopShellParallaxIntensityChange'
	| 'desktopShellWindowMorphEnabled'
	| 'onDesktopShellWindowMorphEnabledChange'
	| 'desktopShellMotionSpeed'
	| 'onDesktopShellMotionSpeedChange'
	| 'showWidgetsPanel'
	| 'onShowWidgetsPanelChange'
	| 'widgetsPanelPosition'
	| 'onWidgetsPanelPositionChange'
	| 'compactWidgets'
	| 'onCompactWidgetsChange'
>;

export const MINIMAL_DESKTOP_EXPANSION_SETTINGS: DesktopExpansionSettings = {
	storageMap: [],
	workspaceProfiles: [],
	savedSessionSnapshotWindowCount: 0,
	windowLayoutPresets: [],
	widgetsLayout: { slots: [], perWorkspace: false },
	appCollections: [],
	contentShortcuts: [],
	assistantContextActions: [],
	visualStylePresets: [],
	isLoading: false,
	isSaving: false,
	error: null,
	addWorkspaceProfile: async () => {},
	addWorkspaceProfileFromOpenWindows: async () => {},
	addWorkspaceProfileFromTemplate: async () => {},
	addWorkspaceProfileFromSessionSnapshot: async () => {},
	patchWorkspaceProfile: async () => {},
	removeWorkspaceProfile: async () => {},
	addWindowLayoutPreset: async () => {},
	addWindowLayoutPresetFromCuratedTemplate: async () => {},
	removeWindowLayoutPreset: async () => {},
	applyWindowLayoutPreset: () => {},
	applyCuratedWorkspaceLayout: () => {},
	addWindowLayoutPresetFromScenario: async () => {},
	applyScenarioWorkspaceLayout: () => {},
	collectCurrentWorkspaceWindows: () => {},
	toggleWidgetSlot: async () => {},
	toggleWidgetSlotMode: async () => {},
	toggleWidgetsPerWorkspace: async () => {},
	reorderWidgetSlots: async () => {},
	moveWidgetSlotStep: async () => {},
	setWidgetSlotWorkspaceProfile: async () => {},
	setWidgetsPanelOffset: async () => {},
	setWidgetsSlotPlacement: async () => {},
	setWidgetSlotPosition: async () => {},
	nudgeAllWidgetSlotPositions: async () => {},
	ensureFreeWidgetSlotPositions: async () => {},
	addAppCollection: async () => {},
	addAppCollectionFromTemplate: async () => {},
	removeAppCollection: async () => {},
	addContentShortcut: async () => {},
	addSavedFilterContentShortcut: async () => {},
	removeContentShortcut: async () => {},
	addVisualStylePreset: async () => {},
	removeVisualStylePreset: async () => {},
	toggleAssistantAction: async () => {},
	refresh: async () => {},
};

export const MINIMAL_DESKTOP_SETTINGS_CENTER: DesktopSettingsCenterBridge = {
	virtualDesktops: {
		desktops: [],
		activeDesktopId: 'd1',
		globalWallpaper: '',
		onCreateDesktop: () => {},
		onDeleteDesktop: () => {},
		onSwitchDesktop: () => {},
		onRenameDesktop: () => {},
		onApplyGlobalWallpaperToDesktop: () => {},
	},
	sync: {
		tabConflictDetected: false,
		clearTabConflict: () => {},
		isSyncing: false,
		storageError: null,
		isOnline: true,
		persistQueue: { config: 0, shell: 0, total: 0 },
		persistPatchFlushFailed: null,
		onFlushPersistQueue: async () => {},
		onRefreshAll: async () => {},
	},
	apps: {
		installedApps: [],
		isAppShortcutOnDesktop: () => false,
		onAddAppToDesktop: () => {},
		onRemoveAppFromDesktop: () => {},
		onOpenAppStore: () => {},
	},
	windows: {
		onBringWindowsIntoWorkArea: () => {},
	},
	syncPrefs: {
		showSeconds: false,
		onShowSecondsChange: () => {},
		quietMode: false,
		onQuietModeChange: () => {},
		timezone: 'Europe/Moscow',
		onTimezoneChange: () => {},
	},
};

/** Minimal props to mount `DesktopSettingsPanel` in Vitest (embedded, static perf). */
export function createMinimalDesktopSettingsPanelProps(
	overrides?: Partial<DesktopSettingsPanelProps>
): DesktopSettingsPanelProps {
	const base: DesktopSettingsPanelProps = {
		isOpen: true,
		onClose: () => {},
		isOnline: true,
		isConfigSaving: false,
		isProfileSaving: false,
		configSaveError: null,
		activeTab: 'personalize',
		onActiveTabChange: () => {},
		theme: 'dark',
		onThemeChange: () => {},
		accent: 'blue',
		accentCustomHex: '',
		onAccentChange: () => {},
		onAccentCustomHexChange: () => {},
		wallpaper: '/desktop-wallpapers/1.webp',
		onWallpaperChange: () => {},
		onOpenWallpaperPicker: () => {},
		iconSize: 'medium',
		onIconSizeChange: () => {},
		snapToGrid: false,
		onSnapToGridChange: () => {},
		gridStep: 'medium',
		onGridStepChange: () => {},
		desktopIconStyle: 'glass',
		onDesktopIconStyleChange: () => {},
		desktopTaskbarStyle: 'glass',
		onDesktopTaskbarStyleChange: () => {},
		desktopWindowStyle: 'glass',
		onDesktopWindowStyleChange: () => {},
		desktopAccentFollowsWindowStyle: false,
		onDesktopAccentFollowsWindowStyleChange: () => {},
		desktopFloatingWidgetVisible: true,
		onDesktopFloatingWidgetVisibleChange: () => {},
		desktopOpenAppsMaximized: false,
		onDesktopOpenAppsMaximizedChange: () => {},
		desktopWidgetsStyle: 'glass',
		onDesktopWidgetsStyleChange: () => {},
		desktopPanelOpacity: 1,
		onDesktopPanelOpacityChange: () => {},
		desktopUiScale: 1,
		onDesktopUiScaleChange: () => {},
		desktopSceneDepth: 'balanced',
		onDesktopSceneDepthChange: () => {},
		desktopFontBody: 'manrope',
		onDesktopFontBodyChange: () => {},
		desktopFontDisplay: 'system',
		onDesktopFontDisplayChange: () => {},
		desktopWallpaperCrossfadeEnabled: true,
		onDesktopWallpaperCrossfadeChange: () => {},
		desktopStyledTooltips: true,
		onDesktopStyledTooltipsChange: () => {},
		desktopShellReduceMotion: false,
		onDesktopShellReduceMotionChange: () => {},
		desktopShellParallaxEnabled: true,
		onDesktopShellParallaxEnabledChange: () => {},
		desktopShellParallaxIntensity: 'normal',
		onDesktopShellParallaxIntensityChange: () => {},
		desktopShellWindowMorphEnabled: true,
		onDesktopShellWindowMorphEnabledChange: () => {},
		desktopShellMotionSpeed: 'normal',
		onDesktopShellMotionSpeedChange: () => {},
		showWidgetsPanel: false,
		onShowWidgetsPanelChange: () => {},
		widgetsPanelPosition: 'top-right',
		onWidgetsPanelPositionChange: () => {},
		compactWidgets: false,
		onCompactWidgetsChange: () => {},
		expansionSettings: MINIMAL_DESKTOP_EXPANSION_SETTINGS,
		settingsCenterBridge: MINIMAL_DESKTOP_SETTINGS_CENTER,
		performance: STATIC_DESKTOP_SETTINGS_PERFORMANCE,
		onApplyCuratedStyleSet: () => {},
		presentation: 'embedded',
	};
	return { ...base, ...overrides };
}

/** Shell visual/style fields for settings bridge integration tests. */
export function createMinimalDesktopShellStylesBridge(
	overrides?: Partial<DesktopShellStylesBridge>
): DesktopShellStylesBridge {
	const panel = createMinimalDesktopSettingsPanelProps();
	return {
		desktopIconStyle: panel.desktopIconStyle,
		onDesktopIconStyleChange: panel.onDesktopIconStyleChange,
		desktopTaskbarStyle: panel.desktopTaskbarStyle,
		onDesktopTaskbarStyleChange: panel.onDesktopTaskbarStyleChange,
		desktopWindowStyle: panel.desktopWindowStyle,
		onDesktopWindowStyleChange: panel.onDesktopWindowStyleChange,
		desktopAccentFollowsWindowStyle: panel.desktopAccentFollowsWindowStyle,
		onDesktopAccentFollowsWindowStyleChange:
			panel.onDesktopAccentFollowsWindowStyleChange,
		desktopFloatingWidgetVisible: panel.desktopFloatingWidgetVisible,
		onDesktopFloatingWidgetVisibleChange:
			panel.onDesktopFloatingWidgetVisibleChange,
		desktopOpenAppsMaximized: panel.desktopOpenAppsMaximized,
		onDesktopOpenAppsMaximizedChange: panel.onDesktopOpenAppsMaximizedChange,
		desktopWidgetsStyle: panel.desktopWidgetsStyle,
		onDesktopWidgetsStyleChange: panel.onDesktopWidgetsStyleChange,
		desktopPanelOpacity: panel.desktopPanelOpacity,
		onDesktopPanelOpacityChange: panel.onDesktopPanelOpacityChange,
		desktopUiScale: panel.desktopUiScale,
		onDesktopUiScaleChange: panel.onDesktopUiScaleChange,
		desktopSceneDepth: panel.desktopSceneDepth,
		onDesktopSceneDepthChange: panel.onDesktopSceneDepthChange,
		desktopFontBody: panel.desktopFontBody,
		onDesktopFontBodyChange: panel.onDesktopFontBodyChange,
		desktopFontDisplay: panel.desktopFontDisplay,
		onDesktopFontDisplayChange: panel.onDesktopFontDisplayChange,
		desktopWallpaperCrossfadeEnabled: panel.desktopWallpaperCrossfadeEnabled,
		onDesktopWallpaperCrossfadeChange: panel.onDesktopWallpaperCrossfadeChange,
		desktopStyledTooltips: panel.desktopStyledTooltips,
		onDesktopStyledTooltipsChange: panel.onDesktopStyledTooltipsChange,
		desktopShellReduceMotion: panel.desktopShellReduceMotion,
		onDesktopShellReduceMotionChange: panel.onDesktopShellReduceMotionChange,
		desktopShellParallaxEnabled: panel.desktopShellParallaxEnabled,
		onDesktopShellParallaxEnabledChange:
			panel.onDesktopShellParallaxEnabledChange,
		desktopShellParallaxIntensity: panel.desktopShellParallaxIntensity,
		onDesktopShellParallaxIntensityChange:
			panel.onDesktopShellParallaxIntensityChange,
		desktopShellWindowMorphEnabled: panel.desktopShellWindowMorphEnabled,
		onDesktopShellWindowMorphEnabledChange:
			panel.onDesktopShellWindowMorphEnabledChange,
		desktopShellMotionSpeed: panel.desktopShellMotionSpeed,
		onDesktopShellMotionSpeedChange: panel.onDesktopShellMotionSpeedChange,
		showWidgetsPanel: panel.showWidgetsPanel,
		onShowWidgetsPanelChange: panel.onShowWidgetsPanelChange,
		widgetsPanelPosition: panel.widgetsPanelPosition,
		onWidgetsPanelPositionChange: panel.onWidgetsPanelPositionChange,
		compactWidgets: panel.compactWidgets,
		onCompactWidgetsChange: panel.onCompactWidgetsChange,
		...overrides,
	};
}
