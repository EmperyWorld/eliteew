/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 21: build Settings Integration Bundle sources from flat TailCluster locals
 * (compresses the former 11-group inline object in ContentTailCluster).
 *
 * Invariants:
 * - Pass-through map to `DesktopWorkspaceSettingsIntegrationBundleSources`.
 * - `iconSize` / `gridStep` default to `'medium'` when nullish (same as TailCluster).
 *
 * Related:
 * - hooks/useDesktopWorkspaceSettingsIntegrationBundle.ts
 * - hooks/useDesktopWorkspaceContentTailCluster.ts
 * - documentation/product/desktop/DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md
 */

import type { TFunction } from 'i18next';
import type {
	Dispatch,
	MutableRefObject,
	RefObject,
	SetStateAction,
} from 'react';
import type { UserPreferencesAppContextValue } from '@/contexts/UserPreferencesAppContext';
import type { UIPreferences } from '@/types/profile';
import type { UserFolderIconId } from '../constants/folderIcons';
import type { AccentColorId } from '../context/DesktopStateContext';
import type { TabId } from '../components/settings/desktopSettingsShared.types';
import type { DesktopShellSettingsBridgeValue } from '../context/DesktopShellSettingsBridgeContext';
import type { DesktopCuratedStyleSet } from '../constants/desktopCuratedStyleSets';
import type {
	DesktopConfig,
	DesktopItem,
	WindowState,
} from '../types/desktop.types';
import type { SettingsCenterVirtualDesktopRow } from '../types/desktopSettingsCenterBridge.types';
import type { DesktopExpansionSettings } from '../types/desktopExpansion.types';
import type { DesktopWorkspaceVisualPreferenceState } from '../hooks/useDesktopWorkspaceVisualProfileBridge';
import type { UseDesktopStorageReturn } from '../hooks/useDesktopStorage';
import type { DesktopShellMotionPrefs } from './resolveDesktopShellMotion';
import type { DesktopWorkspaceSettingsIntegrationBundleSources } from '../hooks/useDesktopWorkspaceSettingsIntegrationBundle';

export type DesktopWorkspaceSettingsIntegrationBundleFlatInput = {
	desktops: SettingsCenterVirtualDesktopRow[];
	activeDesktopId: string;
	wallpaper: string;
	createDesktop: () => void;
	deleteDesktop: (id: string) => void;
	switchToDesktop: (id: string) => void;
	updateDesktopName: (id: string, name: string) => void;
	updateDesktopWallpaper: (id: string, wallpaper: string) => void;
	storage: Pick<
		UseDesktopStorageReturn,
		| 'isOnline'
		| 'isSyncing'
		| 'error'
		| 'tabConflictDetected'
		| 'clearTabConflict'
		| 'refresh'
		| 'isConfigSaving'
		| 'configSaveError'
	>;
	persistPatchStats: { config: number; shell: number; total: number };
	persistPatchFlushFailed: string | null | undefined;
	flushPersistPatches: () => undefined | Promise<undefined | boolean>;
	expansionSettings: DesktopExpansionSettings;
	installedApps: DesktopItem[];
	items: DesktopItem[];
	handlePinAppFromStartMenu: (app: DesktopItem) => void;
	openAppStoreAsWindow: () => void;
	deleteItem: (id: string) => void | Promise<void>;
	windows: WindowState[];
	getWindowsOnDesktop: (desktopId: string) => string[];
	currentDesktopWindows: WindowState[];
	bringWindowsIntoWorkArea: (
		predicate: (window: WindowState) => boolean
	) => void;
	focusWindow: (windowId: string) => void;
	closeWindow: (windowId: string) => void;
	minimizeAllWindows: () => void;
	closeActiveDesktopWindow: () => void;
	activeDesktopWindowId: string | null;
	handleOpenWindow: (item: DesktopItem) => void;
	setShowNF: (value: boolean) => void;
	setShowCommandPalette: (value: boolean) => void;
	config: DesktopConfig | null | undefined;
	desktopVisualPreferences: DesktopWorkspaceVisualPreferenceState;
	deferVisualPersistRef: MutableRefObject<boolean>;
	actions: {
		setTheme: (theme: DesktopConfig['theme']) => void;
		setWallpaper: (wallpaper: string) => void;
		setAccent: (accent: AccentColorId) => void;
		setAccentCustomHex: (hex: string) => void;
	};
	updateConfig: (
		patch: Partial<DesktopConfig>,
		options?: { persistRemote?: boolean }
	) => Promise<void>;
	updateDesktopVisualPreferences: (
		updates: Partial<DesktopWorkspaceVisualPreferenceState>,
		options?: { persist?: boolean }
	) => void | Promise<void>;
	persistSubjectForQueue: string | null | undefined;
	t: TFunction;
	clientLanguage: string;
	theme: DesktopConfig['theme'];
	setTheme: (theme: DesktopConfig['theme']) => void;
	effectiveTheme: 'dark' | 'light';
	desktopThemeVars: Record<string, string>;
	accent: AccentColorId;
	accentCustomHex: string;
	setAccentChoice: (accent: AccentColorId) => void;
	onAccentCustomHexChange: (hex: string) => void;
	applyCuratedDesktopConfigPreset: (
		set: DesktopCuratedStyleSet
	) => void | Promise<void>;
	iconSize: 'small' | 'medium' | 'large' | null | undefined;
	snapToGridEnabled: boolean;
	gridStep: 'small' | 'medium' | 'large' | null | undefined;
	desktopIconStyle: DesktopWorkspaceVisualPreferenceState['desktop_icon_style'];
	desktopTaskbarStyle: DesktopWorkspaceVisualPreferenceState['desktop_taskbar_style'];
	desktopWindowStyle: DesktopWorkspaceVisualPreferenceState['desktop_window_style'];
	showDesktopWidget: boolean;
	desktopOpenAppsMaximized: boolean;
	desktopUiScale: number;
	desktopSettingsActiveTab: TabId;
	setDesktopSettingsActiveTab: (tab: TabId) => void;
	mergedSettingsPerformanceForPanel: DesktopShellSettingsBridgeValue['performance'];
	personalizationStagingActive: boolean;
	startPersonalizationStaging: () => void;
	commitPersonalizationStaging: () => Promise<void>;
	cancelPersonalizationStaging: () => void;
	isProfileUiSaving: boolean;
	setShowWP: (value: boolean) => void;
	preferencesApp: UserPreferencesAppContextValue | null;
	notifyDesktop: { error: (title: string, message: string) => void };
	withProfileUiSaveIndicator: (fn: () => Promise<void>) => Promise<void>;
	clearPanelOpacityPersistTimer: () => void;
	setDesktopVisualPreferences: Dispatch<
		SetStateAction<DesktopWorkspaceVisualPreferenceState>
	>;
	serverUiPreferencesRef: MutableRefObject<UIPreferences>;
	desktopVisualPreferencesRef: MutableRefObject<DesktopWorkspaceVisualPreferenceState>;
	resolvedDesktopVisualPreferencesRef: MutableRefObject<DesktopWorkspaceVisualPreferenceState>;
	panelOpacityPersistTimerRef: MutableRefObject<number | null>;
	createFolderAPI: (
		name: string,
		options?: { parentId?: string; folderIconId?: UserFolderIconId }
	) => Promise<DesktopItem | null>;
	setWallpaper: (wallpaper: string) => void;
	desktopAreaRef: RefObject<HTMLDivElement | null>;
	storageLoading: boolean;
	shellMotionPrefs: DesktopShellMotionPrefs;
};

export function buildDesktopWorkspaceSettingsIntegrationBundleSources(
	input: DesktopWorkspaceSettingsIntegrationBundleFlatInput
): DesktopWorkspaceSettingsIntegrationBundleSources {
	return {
		virtualDesktops: {
			desktops: input.desktops,
			activeDesktopId: input.activeDesktopId,
			wallpaper: input.wallpaper,
			createDesktop: input.createDesktop,
			deleteDesktop: input.deleteDesktop,
			switchToDesktop: input.switchToDesktop,
			updateDesktopName: input.updateDesktopName,
			updateDesktopWallpaper: input.updateDesktopWallpaper,
		},
		storageAndPersist: {
			storage: input.storage,
			persistPatchStats: input.persistPatchStats,
			persistPatchFlushFailed: input.persistPatchFlushFailed,
			flushPersistPatches: input.flushPersistPatches,
		},
		expansionLaunch: {
			expansionSettings: input.expansionSettings,
			installedApps: input.installedApps,
			items: input.items,
			handlePinAppFromStartMenu: input.handlePinAppFromStartMenu,
			openAppStoreAsWindow: input.openAppStoreAsWindow,
			deleteItem: input.deleteItem,
		},
		windowsAndVoice: {
			windows: input.windows,
			getWindowsOnDesktop: input.getWindowsOnDesktop,
			currentDesktopWindows: input.currentDesktopWindows,
			bringWindowsIntoWorkArea: input.bringWindowsIntoWorkArea,
			focusWindow: input.focusWindow,
			closeWindow: input.closeWindow,
			minimizeAllWindows: input.minimizeAllWindows,
			closeActiveDesktopWindow: input.closeActiveDesktopWindow,
			activeDesktopWindowId: input.activeDesktopWindowId,
			handleOpenWindow: input.handleOpenWindow,
			setShowNF: input.setShowNF,
			setShowCommandPalette: input.setShowCommandPalette,
		},
		personalization: {
			config: input.config,
			desktopVisualPreferences: input.desktopVisualPreferences,
			deferVisualPersistRef: input.deferVisualPersistRef,
			actions: input.actions,
			updateConfig: input.updateConfig,
			updateDesktopVisualPreferences: input.updateDesktopVisualPreferences,
			updateDesktopWallpaper: input.updateDesktopWallpaper,
			persistSubjectForQueue: input.persistSubjectForQueue,
		},
		i18n: {
			t: input.t,
			clientLanguage: input.clientLanguage,
		},
		themeSurface: {
			theme: input.theme,
			setTheme: input.setTheme,
			effectiveTheme: input.effectiveTheme,
			desktopThemeVars: input.desktopThemeVars,
			accent: input.accent,
			accentCustomHex: input.accentCustomHex,
			setAccentChoice: input.setAccentChoice,
			onAccentCustomHexChange: input.onAccentCustomHexChange,
			applyCuratedDesktopConfigPreset: input.applyCuratedDesktopConfigPreset,
			iconSize: input.iconSize ?? 'medium',
			snapToGridEnabled: input.snapToGridEnabled,
			gridStep: input.gridStep ?? 'medium',
			desktopIconStyle: input.desktopIconStyle,
			desktopTaskbarStyle: input.desktopTaskbarStyle,
			desktopWindowStyle: input.desktopWindowStyle,
			showDesktopWidget: input.showDesktopWidget,
			desktopOpenAppsMaximized: input.desktopOpenAppsMaximized,
			desktopUiScale: input.desktopUiScale,
		},
		settingsPanel: {
			desktopSettingsActiveTab: input.desktopSettingsActiveTab,
			setDesktopSettingsActiveTab: input.setDesktopSettingsActiveTab,
			mergedSettingsPerformanceForPanel:
				input.mergedSettingsPerformanceForPanel,
			personalizationStagingActive: input.personalizationStagingActive,
			startPersonalizationStaging: input.startPersonalizationStaging,
			commitPersonalizationStaging: input.commitPersonalizationStaging,
			cancelPersonalizationStaging: input.cancelPersonalizationStaging,
			isProfileUiSaving: input.isProfileUiSaving,
		},
		appearanceBridge: {
			setShowWP: input.setShowWP,
			preferencesApp: input.preferencesApp,
			notifyDesktop: input.notifyDesktop,
			withProfileUiSaveIndicator: input.withProfileUiSaveIndicator,
			clearPanelOpacityPersistTimer: input.clearPanelOpacityPersistTimer,
			setDesktopVisualPreferences: input.setDesktopVisualPreferences,
			serverUiPreferencesRef: input.serverUiPreferencesRef,
			desktopVisualPreferencesRef: input.desktopVisualPreferencesRef,
			resolvedDesktopVisualPreferencesRef:
				input.resolvedDesktopVisualPreferencesRef,
			panelOpacityPersistTimerRef: input.panelOpacityPersistTimerRef,
		},
		wallpaperBridge: {
			createFolderAPI: input.createFolderAPI,
			setWallpaper: input.setWallpaper,
		},
		mainSurface: {
			desktopAreaRef: input.desktopAreaRef,
			storageLoading: input.storageLoading,
			shellMotionPrefs: input.shellMotionPrefs,
		},
	};
}

/** Launch-only fields produced in TailCluster after HeadCluster. */
export type DesktopWorkspaceSettingsIntegrationBundleLaunchExtras = Pick<
	DesktopWorkspaceSettingsIntegrationBundleFlatInput,
	'handlePinAppFromStartMenu' | 'openAppStoreAsWindow'
>;

/**
 * HeadCluster fields required to assemble Bundle sources (Wave 21).
 * Structural subset of ContentHeadCluster — avoids importing the full ReturnType.
 */
export type DesktopWorkspaceSettingsIntegrationBundleHeadFields = Omit<
	DesktopWorkspaceSettingsIntegrationBundleFlatInput,
	keyof DesktopWorkspaceSettingsIntegrationBundleLaunchExtras | 'clientLanguage'
> & {
	i18nextInstance: { language: string };
};

/**
 * HeadCluster + launch extras → Bundle sources.
 * TailCluster keeps a short call site; field mapping lives here (Wave 21).
 */
export function buildDesktopWorkspaceSettingsIntegrationBundleSourcesFromHead(
	head: DesktopWorkspaceSettingsIntegrationBundleHeadFields,
	launch: DesktopWorkspaceSettingsIntegrationBundleLaunchExtras
): DesktopWorkspaceSettingsIntegrationBundleSources {
	return buildDesktopWorkspaceSettingsIntegrationBundleSources({
		desktops: head.desktops,
		activeDesktopId: head.activeDesktopId,
		wallpaper: head.wallpaper,
		createDesktop: head.createDesktop,
		deleteDesktop: head.deleteDesktop,
		switchToDesktop: head.switchToDesktop,
		updateDesktopName: head.updateDesktopName,
		updateDesktopWallpaper: head.updateDesktopWallpaper,
		storage: head.storage,
		persistPatchStats: head.persistPatchStats,
		persistPatchFlushFailed: head.persistPatchFlushFailed,
		flushPersistPatches: head.flushPersistPatches,
		expansionSettings: head.expansionSettings,
		installedApps: head.installedApps,
		items: head.items,
		handlePinAppFromStartMenu: launch.handlePinAppFromStartMenu,
		openAppStoreAsWindow: launch.openAppStoreAsWindow,
		deleteItem: head.deleteItem,
		windows: head.windows,
		getWindowsOnDesktop: head.getWindowsOnDesktop,
		currentDesktopWindows: head.currentDesktopWindows,
		bringWindowsIntoWorkArea: head.bringWindowsIntoWorkArea,
		focusWindow: head.focusWindow,
		closeWindow: head.closeWindow,
		minimizeAllWindows: head.minimizeAllWindows,
		closeActiveDesktopWindow: head.closeActiveDesktopWindow,
		activeDesktopWindowId: head.activeDesktopWindowId,
		handleOpenWindow: head.handleOpenWindow,
		setShowNF: head.setShowNF,
		setShowCommandPalette: head.setShowCommandPalette,
		config: head.config,
		desktopVisualPreferences: head.desktopVisualPreferences,
		deferVisualPersistRef: head.deferVisualPersistRef,
		actions: head.actions,
		updateConfig: head.updateConfig,
		updateDesktopVisualPreferences: head.updateDesktopVisualPreferences,
		persistSubjectForQueue: head.persistSubjectForQueue,
		t: head.t,
		clientLanguage: head.i18nextInstance.language,
		theme: head.theme,
		setTheme: head.setTheme,
		effectiveTheme: head.effectiveTheme,
		desktopThemeVars: head.desktopThemeVars,
		accent: head.accent,
		accentCustomHex: head.accentCustomHex,
		setAccentChoice: head.setAccentChoice,
		onAccentCustomHexChange: head.onAccentCustomHexChange,
		applyCuratedDesktopConfigPreset: head.applyCuratedDesktopConfigPreset,
		iconSize: head.iconSize,
		snapToGridEnabled: head.snapToGridEnabled,
		gridStep: head.gridStep,
		desktopIconStyle: head.desktopIconStyle,
		desktopTaskbarStyle: head.desktopTaskbarStyle,
		desktopWindowStyle: head.desktopWindowStyle,
		showDesktopWidget: head.showDesktopWidget,
		desktopOpenAppsMaximized: head.desktopOpenAppsMaximized,
		desktopUiScale: head.desktopUiScale,
		desktopSettingsActiveTab: head.desktopSettingsActiveTab,
		setDesktopSettingsActiveTab: head.setDesktopSettingsActiveTab,
		mergedSettingsPerformanceForPanel: head.mergedSettingsPerformanceForPanel,
		personalizationStagingActive: head.personalizationStagingActive,
		startPersonalizationStaging: head.startPersonalizationStaging,
		commitPersonalizationStaging: head.commitPersonalizationStaging,
		cancelPersonalizationStaging: head.cancelPersonalizationStaging,
		isProfileUiSaving: head.isProfileUiSaving,
		setShowWP: head.setShowWP,
		preferencesApp: head.preferencesApp,
		notifyDesktop: head.notifyDesktop,
		withProfileUiSaveIndicator: head.withProfileUiSaveIndicator,
		clearPanelOpacityPersistTimer: head.clearPanelOpacityPersistTimer,
		setDesktopVisualPreferences: head.setDesktopVisualPreferences,
		serverUiPreferencesRef: head.serverUiPreferencesRef,
		desktopVisualPreferencesRef: head.desktopVisualPreferencesRef,
		resolvedDesktopVisualPreferencesRef:
			head.resolvedDesktopVisualPreferencesRef,
		panelOpacityPersistTimerRef: head.panelOpacityPersistTimerRef,
		createFolderAPI: head.createFolderAPI,
		setWallpaper: head.setWallpaper,
		desktopAreaRef: head.desktopAreaRef,
		storageLoading: head.storageLoading,
		shellMotionPrefs: head.shellMotionPrefs,
	});
}
