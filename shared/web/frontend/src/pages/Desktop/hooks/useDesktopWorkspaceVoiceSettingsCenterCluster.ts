/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * T35 cluster: settings-center integration, voice commands, virtual-desktop wallpaper memos,
 * and settings surface chrome facade — one call site in DesktopWorkspaceContent.
 *
 * Invariants:
 * - Hook order: integration → facade; integration outputs wire facade shell/chrome.
 * - Voice command listeners defer to DesktopDeferredVoiceCommandsRuntime.
 *
 * Related:
 * - types/desktopWorkspaceVoiceSettingsCenterCluster.types.ts
 * - documentation/product/desktop/DESKTOP-WORKSPACE-CONTENT-REFACTOR-PLAN.md
 */

import { useMemo } from 'react';
import type {
	DesktopWorkspaceVoiceSettingsCenterClusterInput,
	DesktopWorkspaceVoiceSettingsCenterClusterResult,
	DesktopWorkspaceVoiceSettingsCenterVirtualDesktopGroup,
} from '../types/desktopWorkspaceVoiceSettingsCenterCluster.types';
import { useDesktopWorkspaceSettingsCenterIntegration } from './useDesktopWorkspaceSettingsCenterIntegration';
import { useDesktopWorkspaceSettingsSurfaceChromeFacade } from './useDesktopWorkspaceSettingsSurfaceChromeFacade';

function resolveMainSurfaceWallpaper({
	desktops,
	activeDesktopId,
	wallpaper,
}: DesktopWorkspaceVoiceSettingsCenterVirtualDesktopGroup): string {
	const d = desktops.find((x) => x.id === activeDesktopId);
	const override = d?.wallpaper?.trim();
	return override ? (d?.wallpaper as string) : wallpaper;
}

function resolveActiveVirtualDesktopShell({
	desktops,
	activeDesktopId,
}: Pick<
	DesktopWorkspaceVoiceSettingsCenterVirtualDesktopGroup,
	'desktops' | 'activeDesktopId'
>): { id: string; name: string } {
	const d = desktops.find((x) => x.id === activeDesktopId);
	return {
		id: activeDesktopId,
		name: d?.name?.trim() ?? '',
	};
}

export function useDesktopWorkspaceVoiceSettingsCenterCluster(
	input: DesktopWorkspaceVoiceSettingsCenterClusterInput
): DesktopWorkspaceVoiceSettingsCenterClusterResult {
	const { settingsCenter, surfaceChrome } = input;
	const {
		bridgeVirtualDesktops,
		bridgeSync,
		bridgeAppsWindows,
		bridgeI18n,
		personalization,
		workspaceProfiles,
	} = settingsCenter;

	const {
		settingsCenterBridge,
		workspaceProfilesShellContext,
		clearActiveDesktopWallpaperOverride,
		onApplyUserVisualStylePreset,
		onExportPersonalizationPackJson,
		onImportPersonalizationPackJson,
	} = useDesktopWorkspaceSettingsCenterIntegration({
		bridge: {
			...bridgeVirtualDesktops,
			...bridgeSync,
			...bridgeAppsWindows,
			t: bridgeI18n.t,
			clientLanguage: bridgeI18n.clientLanguage,
		},
		personalization,
		workspaceProfilesShellContext: workspaceProfiles,
	});

	const mainSurfaceWallpaper = useMemo(
		() => resolveMainSurfaceWallpaper(surfaceChrome.virtualDesktop),
		[surfaceChrome.virtualDesktop]
	);

	const activeVirtualDesktopShell = useMemo(
		() => resolveActiveVirtualDesktopShell(surfaceChrome.virtualDesktop),
		[surfaceChrome.virtualDesktop]
	);

	const { shellClusterRest, surfaceChromeBundleInput } =
		useDesktopWorkspaceSettingsSurfaceChromeFacade({
			visual: surfaceChrome.visual,
			shell: {
				...surfaceChrome.shellRest,
				settingsCenterBridge,
				workspaceProfilesShellContext,
				onApplyUserVisualStylePreset,
				onExportPersonalizationPackJson,
				onImportPersonalizationPackJson,
			},
			chrome: {
				appearance: surfaceChrome.appearance,
				wallpaper: {
					...surfaceChrome.wallpaperRest,
					clearActiveDesktopWallpaperOverride,
				},
				mainSurface: {
					...surfaceChrome.mainSurfaceRest,
					wallpaper: mainSurfaceWallpaper,
				},
			},
		});

	return {
		settingsCenterBridge,
		workspaceProfilesShellContext,
		shellClusterRest,
		surfaceChromeBundleInput,
		mainSurfaceWallpaper,
		activeVirtualDesktopShell,
	};
}
