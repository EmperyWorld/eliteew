/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * T35 input assembler: maps coarse workspace source slices to settings cluster input
 * via Wave 20 visual + persistence pure builders.
 *
 * Invariants:
 * - Pass-through field mapping only; cluster hook owns integration → facade wiring.
 * - Visual/persist ownership: `desktopWorkspaceSettingsIntegrationSlices.ts`.
 *
 * Related:
 * - hooks/useDesktopWorkspaceSettingsIntegrationBundle.ts
 * - hooks/useDesktopWorkspaceVoiceSettingsCenterCluster.ts
 * - types/desktopWorkspaceVoiceSettingsCenterCluster.types.ts
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
import type {
	DesktopConfig,
	DesktopItem,
	WindowState,
} from '../types/desktop.types';
import type { SettingsCenterVirtualDesktopRow } from '../types/desktopSettingsCenterBridge.types';
import type { DesktopExpansionSettings } from '../types/desktopExpansion.types';
import type { DesktopWorkspaceVisualPreferenceState } from './useDesktopWorkspaceVisualProfileBridge';
import type { TabId } from '../components/settings/desktopSettingsShared.types';
import type { DesktopShellSettingsBridgeValue } from '../context/DesktopShellSettingsBridgeContext';
import type { UseDesktopStorageReturn } from './useDesktopStorage';
import type { DesktopShellMotionPrefs } from '../utils/resolveDesktopShellMotion';
import type { DesktopWorkspaceVoiceSettingsCenterClusterResult } from '../types/desktopWorkspaceVoiceSettingsCenterCluster.types';
import {
	buildDesktopWorkspaceSettingsPersistenceSlice,
	buildDesktopWorkspaceSettingsVisualSlice,
	mergeDesktopWorkspaceSettingsShellRest,
} from '../utils/desktopWorkspaceSettingsIntegrationSlices';
import { useDesktopWorkspaceVoiceSettingsCenterCluster } from './useDesktopWorkspaceVoiceSettingsCenterCluster';

type DesktopConfigVisualActions = {
	setTheme: (theme: DesktopConfig['theme']) => void;
	setWallpaper: (wallpaper: string) => void;
	setAccent: (accent: AccentColorId) => void;
	setAccentCustomHex: (hex: string) => void;
};

export type DesktopWorkspaceVoiceSettingsCenterClusterSources = {
	virtualDesktops: {
		desktops: SettingsCenterVirtualDesktopRow[];
		activeDesktopId: string;
		wallpaper: string;
		createDesktop: () => void;
		deleteDesktop: (id: string) => void;
		switchToDesktop: (id: string) => void;
		updateDesktopName: (id: string, name: string) => void;
		updateDesktopWallpaper: (id: string, wallpaper: string) => void;
	};
	storageAndPersist: {
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
	};
	expansionLaunch: {
		expansionSettings: DesktopExpansionSettings;
		installedApps: DesktopItem[];
		items: DesktopItem[];
		handlePinAppFromStartMenu: (app: DesktopItem) => void;
		openAppStoreAsWindow: () => void;
		deleteItem: (id: string) => void | Promise<void>;
	};
	windowsAndVoice: {
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
	};
	personalization: {
		config: DesktopConfig | null | undefined;
		desktopVisualPreferences: DesktopWorkspaceVisualPreferenceState;
		deferVisualPersistRef: MutableRefObject<boolean>;
		actions: DesktopConfigVisualActions;
		updateConfig: (
			patch: Partial<DesktopConfig>,
			options?: { persistRemote?: boolean }
		) => Promise<void>;
		updateDesktopVisualPreferences: (
			updates: Partial<DesktopWorkspaceVisualPreferenceState>,
			options?: { persist?: boolean }
		) => void | Promise<void>;
		updateDesktopWallpaper: (id: string, wallpaper: string) => void;
		persistSubjectForQueue: string | null | undefined;
	};
	i18n: {
		t: TFunction;
		clientLanguage: string;
	};
	themeSurface: {
		theme: DesktopConfig['theme'];
		setTheme: (theme: DesktopConfig['theme']) => void;
		effectiveTheme: 'dark' | 'light';
		desktopThemeVars: Record<string, string>;
		accent: AccentColorId;
		accentCustomHex: string;
		setAccentChoice: (accent: AccentColorId) => void;
		onAccentCustomHexChange: (hex: string) => void;
		applyCuratedDesktopConfigPreset: (
			set: import('../constants/desktopCuratedStyleSets').DesktopCuratedStyleSet
		) => void | Promise<void>;
		iconSize: 'small' | 'medium' | 'large';
		snapToGridEnabled: boolean;
		gridStep: 'small' | 'medium' | 'large';
		desktopIconStyle: DesktopWorkspaceVisualPreferenceState['desktop_icon_style'];
		desktopTaskbarStyle: DesktopWorkspaceVisualPreferenceState['desktop_taskbar_style'];
		desktopWindowStyle: DesktopWorkspaceVisualPreferenceState['desktop_window_style'];
		showDesktopWidget: boolean;
		desktopOpenAppsMaximized: boolean;
		desktopUiScale: number;
	};
	settingsPanel: {
		desktopSettingsActiveTab: TabId;
		setDesktopSettingsActiveTab: (tab: TabId) => void;
		mergedSettingsPerformanceForPanel: DesktopShellSettingsBridgeValue['performance'];
		personalizationStagingActive: boolean;
		startPersonalizationStaging: () => void;
		commitPersonalizationStaging: () => Promise<void>;
		cancelPersonalizationStaging: () => void;
		isProfileUiSaving: boolean;
	};
	appearanceBridge: {
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
	};
	wallpaperBridge: {
		createFolderAPI: (
			name: string,
			options?: { parentId?: string; folderIconId?: UserFolderIconId }
		) => Promise<DesktopItem | null>;
		setWallpaper: (wallpaper: string) => void;
	};
	mainSurface: {
		desktopAreaRef: RefObject<HTMLDivElement | null>;
		storageLoading: boolean;
		shellMotionPrefs: DesktopShellMotionPrefs;
	};
};

export function useDesktopWorkspaceVoiceSettingsCenterClusterInput(
	sources: DesktopWorkspaceVoiceSettingsCenterClusterSources
): DesktopWorkspaceVoiceSettingsCenterClusterResult {
	const {
		virtualDesktops,
		storageAndPersist,
		expansionLaunch,
		windowsAndVoice,
		personalization,
		i18n,
		themeSurface,
		settingsPanel,
		appearanceBridge,
		wallpaperBridge,
		mainSurface,
	} = sources;

	const visualSlice = buildDesktopWorkspaceSettingsVisualSlice({
		personalization,
		themeSurface,
		appearanceBridge,
		wallpaperBridge,
		mainSurface,
		virtualDesktops,
	});
	const persistenceSlice = buildDesktopWorkspaceSettingsPersistenceSlice({
		storageAndPersist,
		settingsPanel,
	});

	return useDesktopWorkspaceVoiceSettingsCenterCluster({
		settingsCenter: {
			bridgeVirtualDesktops: {
				desktops: virtualDesktops.desktops,
				activeDesktopId: virtualDesktops.activeDesktopId,
				wallpaper: virtualDesktops.wallpaper,
				createDesktop: virtualDesktops.createDesktop,
				deleteDesktop: virtualDesktops.deleteDesktop,
				switchToDesktop: virtualDesktops.switchToDesktop,
				updateDesktopName: virtualDesktops.updateDesktopName,
				updateDesktopWallpaper: virtualDesktops.updateDesktopWallpaper,
			},
			bridgeSync: persistenceSlice.bridgeSync,
			bridgeAppsWindows: {
				expansionSettings: expansionLaunch.expansionSettings,
				installedApps: expansionLaunch.installedApps,
				items: expansionLaunch.items,
				handlePinAppFromStartMenu: expansionLaunch.handlePinAppFromStartMenu,
				deleteItem: expansionLaunch.deleteItem,
				openAppStoreAsWindow: expansionLaunch.openAppStoreAsWindow,
				getWindowsOnDesktop: windowsAndVoice.getWindowsOnDesktop,
				currentDesktopWindows: windowsAndVoice.currentDesktopWindows,
				bringWindowsIntoWorkArea: windowsAndVoice.bringWindowsIntoWorkArea,
			},
			bridgeI18n: {
				t: i18n.t,
				clientLanguage: i18n.clientLanguage,
			},
			personalization: {
				config: personalization.config,
				desktopVisualPreferences: personalization.desktopVisualPreferences,
				deferVisualPersistRef: personalization.deferVisualPersistRef,
				actions: personalization.actions,
				updateConfig: personalization.updateConfig,
				updateDesktopVisualPreferences:
					personalization.updateDesktopVisualPreferences,
				updateDesktopWallpaper: personalization.updateDesktopWallpaper,
				activeDesktopId: virtualDesktops.activeDesktopId,
				persistSubjectForQueue: personalization.persistSubjectForQueue,
			},
			workspaceProfiles: {
				windows: windowsAndVoice.windows,
				getWindowsOnDesktop: windowsAndVoice.getWindowsOnDesktop,
				activeDesktopId: virtualDesktops.activeDesktopId,
			},
		},
		surfaceChrome: {
			visual: visualSlice.visual,
			shellRest: mergeDesktopWorkspaceSettingsShellRest({
				visual: visualSlice.shellVisual,
				persist: persistenceSlice.shellPersist,
				rest: {
					activeTab: settingsPanel.desktopSettingsActiveTab,
					onActiveTabChange: settingsPanel.setDesktopSettingsActiveTab,
					expansionSettings: expansionLaunch.expansionSettings,
					performance: settingsPanel.mergedSettingsPerformanceForPanel,
				},
			}),
			appearance: visualSlice.appearance,
			wallpaperRest: visualSlice.wallpaperRest,
			mainSurfaceRest: visualSlice.mainSurfaceRest,
			virtualDesktop: {
				desktops: virtualDesktops.desktops,
				activeDesktopId: virtualDesktops.activeDesktopId,
				wallpaper: virtualDesktops.wallpaper,
			},
		},
	});
}
