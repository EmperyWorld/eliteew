/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 24: build `derived` group for Shell Layout bridge input.
 *
 * Related:
 * - buildDesktopWorkspaceShellLayoutInputBridgeInput.ts
 */

import type { DesktopWorkspaceShellLayoutInputBridgeInput } from '../../hooks/useDesktopWorkspaceShellLayoutInputBridge';
import type { DesktopWorkspaceShellLayoutInputAssemblySources } from './desktopWorkspaceShellLayoutInputAssembly.types';

export function buildDesktopWorkspaceShellLayoutBridgeDerived(
	sources: DesktopWorkspaceShellLayoutInputAssemblySources
): DesktopWorkspaceShellLayoutInputBridgeInput['derived'] {
	return {
		contextMenuAndOverlays: {
			setWindowContextMenu: sources.setWindowContextMenu,
			setShowShortcutsHelp: sources.setShowShortcutsHelp,
			setShowSessionInfoPanel: sources.setShowSessionInfoPanel,
		},
		shellSettingsAndAdmin: {
			openShellSettings: sources.openShellSettings,
			canOpenUnifiedAdmin: sources.canOpenUnifiedAdmin,
			handleOpenWindow: sources.handleOpenWindow,
			unifiedAdminDesktopItem: sources.unifiedAdminDesktopItem,
		},
		virtualDesktopsState: {
			desktops: sources.desktops,
			activeDesktopId: sources.activeDesktopId,
			createDesktop: sources.createDesktop,
			deleteDesktop: sources.deleteDesktop,
			switchToDesktop: sources.switchToDesktop,
			updateDesktopName: sources.updateDesktopName,
			workspaceProfiles: sources.expansionSettings.workspaceProfiles,
			onOpenWorkspaceProfile: sources.openWorkspaceProfile,
			vdDropHoverId: sources.vdDropHoverId,
		},
	};
}
