/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 23: build Shell Layout Root cluster params from Tail locals
 * (thin Tail call site).
 *
 * Related:
 * - hooks/useDesktopWorkspaceShellLayoutRootCluster.ts
 * - hooks/useDesktopWorkspaceContentTailCluster.ts
 */

import type { useDesktopWorkspaceShellLayoutRootCluster } from '../hooks/useDesktopWorkspaceShellLayoutRootCluster';

export type DesktopWorkspaceShellLayoutRootClusterParams = Parameters<
	typeof useDesktopWorkspaceShellLayoutRootCluster
>[0];

export function buildDesktopWorkspaceShellLayoutRootClusterParams(
	parts: DesktopWorkspaceShellLayoutRootClusterParams
): DesktopWorkspaceShellLayoutRootClusterParams {
	return {
		openVoiceCommandCenter: parts.openVoiceCommandCenter,
		t: parts.t,
		workspaceShellCss: parts.workspaceShellCss,
		desktopAreaRef: parts.desktopAreaRef,
		effectiveTheme: parts.effectiveTheme,
		desktopMainSurfaceStyle: parts.desktopMainSurfaceStyle,
		isDraggingIcon: parts.isDraggingIcon,
		groupDragState: parts.groupDragState,
		desktopWindowStyle: parts.desktopWindowStyle,
		shellSettingsBridge: parts.shellSettingsBridge,
		desktopUiScale: parts.desktopUiScale,
		hasOpenStudioGUWindow: parts.hasOpenStudioGUWindow,
		activeVirtualDesktopId: parts.activeVirtualDesktopId,
		activeVirtualDesktopName: parts.activeVirtualDesktopName,
	};
}
