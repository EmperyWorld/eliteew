/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 20 pure builders: visual + persistence slices for Settings Center integration
 * assembly (TailCluster → facade). No hooks — composition only.
 *
 * Invariants:
 * - Field shapes match `DesktopWorkspaceVoiceSettingsCenterClusterInput` surfaceChrome /
 *   settingsCenter.bridgeSync contracts (Wave 18–19).
 * - Does not invent defaults beyond the prior ClusterInput pass-through map.
 *
 * Related:
 * - hooks/useDesktopWorkspaceSettingsIntegrationBundle.ts
 * - documentation/product/desktop/DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md
 */

import type {
	DesktopWorkspaceVoiceSettingsCenterAppearanceGroup,
	DesktopWorkspaceVoiceSettingsCenterBridgeSyncGroup,
	DesktopWorkspaceVoiceSettingsCenterMainSurfaceRestGroup,
	DesktopWorkspaceVoiceSettingsCenterShellRestGroup,
	DesktopWorkspaceVoiceSettingsCenterVisualGroup,
	DesktopWorkspaceVoiceSettingsCenterWallpaperRestGroup,
} from '../types/desktopWorkspaceVoiceSettingsCenterCluster.types';

export type DesktopWorkspaceSettingsVisualSlice = {
	visual: DesktopWorkspaceVoiceSettingsCenterVisualGroup;
	appearance: DesktopWorkspaceVoiceSettingsCenterAppearanceGroup;
	wallpaperRest: DesktopWorkspaceVoiceSettingsCenterWallpaperRestGroup;
	mainSurfaceRest: DesktopWorkspaceVoiceSettingsCenterMainSurfaceRestGroup;
	shellVisual: Pick<
		DesktopWorkspaceVoiceSettingsCenterShellRestGroup,
		| 'applyCuratedDesktopConfigPreset'
		| 'updateDesktopVisualPreferences'
		| 'updateConfig'
		| 'config'
		| 'theme'
		| 'onThemeChange'
		| 'accent'
		| 'accentCustomHex'
		| 'onAccentChange'
		| 'onAccentCustomHexChange'
		| 'wallpaper'
		| 'iconSize'
		| 'snapToGridEnabled'
		| 'gridStep'
		| 'desktopIconStyle'
		| 'desktopTaskbarStyle'
		| 'desktopWindowStyle'
		| 'desktopFloatingWidgetVisible'
		| 'desktopOpenAppsMaximized'
		| 'desktopUiScale'
	>;
};

export type DesktopWorkspaceSettingsPersistenceSlice = {
	bridgeSync: DesktopWorkspaceVoiceSettingsCenterBridgeSyncGroup;
	shellPersist: Pick<
		DesktopWorkspaceVoiceSettingsCenterShellRestGroup,
		| 'isOnline'
		| 'isConfigSaving'
		| 'isProfileSaving'
		| 'configSaveError'
		| 'profilePatchRemote'
		| 'personalizationStagingActive'
		| 'onPersonalizationStagingStart'
		| 'onPersonalizationStagingCommit'
		| 'onPersonalizationStagingCancel'
	>;
};

/** Coarse sources for visual slice — satisfied by TailCluster / ClusterInput sources. */
export type DesktopWorkspaceSettingsVisualSliceSources = {
	personalization: {
		desktopVisualPreferences: DesktopWorkspaceVoiceSettingsCenterVisualGroup['desktopVisualPreferences'];
		updateDesktopVisualPreferences: DesktopWorkspaceVoiceSettingsCenterShellRestGroup['updateDesktopVisualPreferences'];
		updateConfig: DesktopWorkspaceVoiceSettingsCenterShellRestGroup['updateConfig'];
		config: DesktopWorkspaceVoiceSettingsCenterShellRestGroup['config'];
		deferVisualPersistRef: DesktopWorkspaceVoiceSettingsCenterAppearanceGroup['deferProfilePersistRef'];
	};
	themeSurface: {
		desktopWindowStyle: DesktopWorkspaceVoiceSettingsCenterVisualGroup['desktopWindowStyle'];
		accent: DesktopWorkspaceVoiceSettingsCenterVisualGroup['accent'];
		accentCustomHex: DesktopWorkspaceVoiceSettingsCenterVisualGroup['accentCustomHex'];
		applyCuratedDesktopConfigPreset: DesktopWorkspaceVoiceSettingsCenterShellRestGroup['applyCuratedDesktopConfigPreset'];
		theme: DesktopWorkspaceVoiceSettingsCenterShellRestGroup['theme'];
		setTheme: DesktopWorkspaceVoiceSettingsCenterShellRestGroup['onThemeChange'];
		setAccentChoice: DesktopWorkspaceVoiceSettingsCenterShellRestGroup['onAccentChange'];
		onAccentCustomHexChange: DesktopWorkspaceVoiceSettingsCenterShellRestGroup['onAccentCustomHexChange'];
		iconSize: DesktopWorkspaceVoiceSettingsCenterShellRestGroup['iconSize'];
		snapToGridEnabled: DesktopWorkspaceVoiceSettingsCenterShellRestGroup['snapToGridEnabled'];
		gridStep: DesktopWorkspaceVoiceSettingsCenterShellRestGroup['gridStep'];
		desktopIconStyle: DesktopWorkspaceVoiceSettingsCenterShellRestGroup['desktopIconStyle'];
		desktopTaskbarStyle: DesktopWorkspaceVoiceSettingsCenterShellRestGroup['desktopTaskbarStyle'];
		showDesktopWidget: DesktopWorkspaceVoiceSettingsCenterShellRestGroup['desktopFloatingWidgetVisible'];
		desktopOpenAppsMaximized: DesktopWorkspaceVoiceSettingsCenterShellRestGroup['desktopOpenAppsMaximized'];
		desktopUiScale: DesktopWorkspaceVoiceSettingsCenterShellRestGroup['desktopUiScale'];
		desktopThemeVars: DesktopWorkspaceVoiceSettingsCenterMainSurfaceRestGroup['desktopThemeVars'];
		effectiveTheme: DesktopWorkspaceVoiceSettingsCenterMainSurfaceRestGroup['effectiveTheme'];
	};
	appearanceBridge: Omit<
		DesktopWorkspaceVoiceSettingsCenterAppearanceGroup,
		'updateConfig' | 'updateDesktopVisualPreferences' | 'deferProfilePersistRef'
	>;
	wallpaperBridge: Pick<
		DesktopWorkspaceVoiceSettingsCenterWallpaperRestGroup,
		'createFolderAPI' | 'setWallpaper'
	>;
	mainSurface: {
		desktopAreaRef: DesktopWorkspaceVoiceSettingsCenterMainSurfaceRestGroup['desktopAreaRef'];
		storageLoading: DesktopWorkspaceVoiceSettingsCenterMainSurfaceRestGroup['storageLoading'];
		shellMotionPrefs: {
			parallaxEnabled: boolean;
			parallaxIntensityScale: DesktopWorkspaceVoiceSettingsCenterMainSurfaceRestGroup['parallaxIntensityScale'];
		};
	};
	virtualDesktops: {
		wallpaper: DesktopWorkspaceVoiceSettingsCenterShellRestGroup['wallpaper'];
	};
};

export type DesktopWorkspaceSettingsPersistenceSliceSources = {
	storageAndPersist: {
		storage: {
			tabConflictDetected: DesktopWorkspaceVoiceSettingsCenterBridgeSyncGroup['tabConflictDetected'];
			clearTabConflict: DesktopWorkspaceVoiceSettingsCenterBridgeSyncGroup['clearTabConflict'];
			isSyncing: DesktopWorkspaceVoiceSettingsCenterBridgeSyncGroup['isSyncing'];
			error: DesktopWorkspaceVoiceSettingsCenterBridgeSyncGroup['storageError'];
			isOnline: DesktopWorkspaceVoiceSettingsCenterBridgeSyncGroup['isOnline'];
			refresh: DesktopWorkspaceVoiceSettingsCenterBridgeSyncGroup['refreshStorage'];
			isConfigSaving: DesktopWorkspaceVoiceSettingsCenterShellRestGroup['isConfigSaving'];
			configSaveError: string | null | undefined;
		};
		persistPatchStats: DesktopWorkspaceVoiceSettingsCenterBridgeSyncGroup['persistPatchStats'];
		persistPatchFlushFailed: DesktopWorkspaceVoiceSettingsCenterBridgeSyncGroup['persistPatchFlushFailed'];
		flushPersistPatches: () => undefined | Promise<undefined | boolean>;
	};
	settingsPanel: {
		isProfileUiSaving: DesktopWorkspaceVoiceSettingsCenterShellRestGroup['isProfileSaving'];
		personalizationStagingActive: DesktopWorkspaceVoiceSettingsCenterShellRestGroup['personalizationStagingActive'];
		startPersonalizationStaging: DesktopWorkspaceVoiceSettingsCenterShellRestGroup['onPersonalizationStagingStart'];
		commitPersonalizationStaging: DesktopWorkspaceVoiceSettingsCenterShellRestGroup['onPersonalizationStagingCommit'];
		cancelPersonalizationStaging: DesktopWorkspaceVoiceSettingsCenterShellRestGroup['onPersonalizationStagingCancel'];
	};
};

export function buildDesktopWorkspaceSettingsVisualSlice(
	sources: DesktopWorkspaceSettingsVisualSliceSources
): DesktopWorkspaceSettingsVisualSlice {
	const {
		personalization,
		themeSurface,
		appearanceBridge,
		wallpaperBridge,
		mainSurface,
		virtualDesktops,
	} = sources;

	return {
		visual: {
			desktopVisualPreferences: personalization.desktopVisualPreferences,
			desktopWindowStyle: themeSurface.desktopWindowStyle,
			accent: themeSurface.accent,
			accentCustomHex: themeSurface.accentCustomHex,
		},
		shellVisual: {
			applyCuratedDesktopConfigPreset:
				themeSurface.applyCuratedDesktopConfigPreset,
			updateDesktopVisualPreferences:
				personalization.updateDesktopVisualPreferences,
			updateConfig: personalization.updateConfig,
			config: personalization.config,
			theme: themeSurface.theme,
			onThemeChange: themeSurface.setTheme,
			accent: themeSurface.accent,
			accentCustomHex: themeSurface.accentCustomHex,
			onAccentChange: themeSurface.setAccentChoice,
			onAccentCustomHexChange: themeSurface.onAccentCustomHexChange,
			wallpaper: virtualDesktops.wallpaper,
			iconSize: themeSurface.iconSize,
			snapToGridEnabled: themeSurface.snapToGridEnabled,
			gridStep: themeSurface.gridStep,
			desktopIconStyle: themeSurface.desktopIconStyle,
			desktopTaskbarStyle: themeSurface.desktopTaskbarStyle,
			desktopWindowStyle: themeSurface.desktopWindowStyle,
			desktopFloatingWidgetVisible: themeSurface.showDesktopWidget,
			desktopOpenAppsMaximized: themeSurface.desktopOpenAppsMaximized,
			desktopUiScale: themeSurface.desktopUiScale,
		},
		appearance: {
			setShowWP: appearanceBridge.setShowWP,
			updateConfig: personalization.updateConfig,
			updateDesktopVisualPreferences:
				personalization.updateDesktopVisualPreferences,
			clearPanelOpacityPersistTimer:
				appearanceBridge.clearPanelOpacityPersistTimer,
			setDesktopVisualPreferences: appearanceBridge.setDesktopVisualPreferences,
			notifyDesktop: appearanceBridge.notifyDesktop,
			preferencesApp: appearanceBridge.preferencesApp,
			withProfileUiSaveIndicator: appearanceBridge.withProfileUiSaveIndicator,
			serverUiPreferencesRef: appearanceBridge.serverUiPreferencesRef,
			desktopVisualPreferencesRef: appearanceBridge.desktopVisualPreferencesRef,
			resolvedDesktopVisualPreferencesRef:
				appearanceBridge.resolvedDesktopVisualPreferencesRef,
			panelOpacityPersistTimerRef: appearanceBridge.panelOpacityPersistTimerRef,
			deferProfilePersistRef: personalization.deferVisualPersistRef,
		},
		wallpaperRest: {
			createFolderAPI: wallpaperBridge.createFolderAPI,
			setWallpaper: wallpaperBridge.setWallpaper,
			updateConfig: personalization.updateConfig,
			deferConfigPersistRef: personalization.deferVisualPersistRef,
			wallpaper: virtualDesktops.wallpaper,
			wallpaperHistory: personalization.config?.wallpaper_history,
		},
		mainSurfaceRest: {
			desktopAreaRef: mainSurface.desktopAreaRef,
			desktopThemeVars: themeSurface.desktopThemeVars,
			effectiveTheme: themeSurface.effectiveTheme,
			storageLoading: mainSurface.storageLoading,
			parallaxDisabled:
				mainSurface.storageLoading ||
				!mainSurface.shellMotionPrefs.parallaxEnabled,
			parallaxIntensityScale:
				mainSurface.shellMotionPrefs.parallaxIntensityScale,
			desktopFontBody:
				personalization.desktopVisualPreferences.desktop_font_body,
			desktopFontDisplay:
				personalization.desktopVisualPreferences.desktop_font_display,
			desktopSceneDepth:
				personalization.desktopVisualPreferences.desktop_scene_depth,
			wallpaperCrossfadeEnabled:
				personalization.desktopVisualPreferences
					.desktop_wallpaper_crossfade_enabled !== false,
			styledTooltips:
				personalization.desktopVisualPreferences.desktop_styled_tooltips !==
				false,
		},
	};
}

export function buildDesktopWorkspaceSettingsPersistenceSlice(
	sources: DesktopWorkspaceSettingsPersistenceSliceSources
): DesktopWorkspaceSettingsPersistenceSlice {
	const { storageAndPersist, settingsPanel } = sources;
	const {
		storage,
		persistPatchStats,
		persistPatchFlushFailed,
		flushPersistPatches,
	} = storageAndPersist;

	return {
		bridgeSync: {
			tabConflictDetected: storage.tabConflictDetected,
			clearTabConflict: storage.clearTabConflict,
			isSyncing: storage.isSyncing,
			storageError: storage.error,
			isOnline: storage.isOnline,
			persistPatchStats,
			persistPatchFlushFailed,
			flushPersistPatches: async () => {
				await flushPersistPatches();
			},
			refreshStorage: storage.refresh,
		},
		shellPersist: {
			isOnline: storage.isOnline,
			isConfigSaving: storage.isConfigSaving,
			isProfileSaving: settingsPanel.isProfileUiSaving,
			configSaveError: storage.configSaveError ?? null,
			profilePatchRemote: !settingsPanel.personalizationStagingActive,
			personalizationStagingActive: settingsPanel.personalizationStagingActive,
			onPersonalizationStagingStart: settingsPanel.startPersonalizationStaging,
			onPersonalizationStagingCommit:
				settingsPanel.commitPersonalizationStaging,
			onPersonalizationStagingCancel:
				settingsPanel.cancelPersonalizationStaging,
		},
	};
}

/** Merge Wave 20 slices + remaining shell chrome fields into facade shellRest. */
export function mergeDesktopWorkspaceSettingsShellRest(params: {
	visual: DesktopWorkspaceSettingsVisualSlice['shellVisual'];
	persist: DesktopWorkspaceSettingsPersistenceSlice['shellPersist'];
	rest: Pick<
		DesktopWorkspaceVoiceSettingsCenterShellRestGroup,
		'activeTab' | 'onActiveTabChange' | 'expansionSettings' | 'performance'
	>;
}): DesktopWorkspaceVoiceSettingsCenterShellRestGroup {
	return {
		...params.visual,
		...params.persist,
		...params.rest,
	};
}
