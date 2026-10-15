/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 23: memoized expansion-launch actions input + hook (dedupes Tail listing).
 *
 * Related:
 * - utils/desktopWorkspaceDeferredRuntimeInputs.ts
 * - hooks/useDesktopWorkspaceExpansionLaunchActions.ts
 * - hooks/useDesktopWorkspaceContentTailCluster.ts
 */

import * as React from 'react';
import { useDesktopWorkspaceExpansionLaunchActions } from './useDesktopWorkspaceExpansionLaunchActions';
import type { DesktopWorkspaceExpansionLaunchActionsInput } from '../types/desktopWorkspaceExpansionLaunchActions.types';
import { buildDesktopWorkspaceExpansionLaunchActionsInput } from '../utils/desktopWorkspaceDeferredRuntimeInputs';

export function useDesktopWorkspaceExpansionLaunchActionsFromParts(
	parts: DesktopWorkspaceExpansionLaunchActionsInput
) {
	const {
		items,
		installedApps,
		selected,
		activeDesktopId,
		activeDesktopWindow,
		windows,
		expansion,
		handleOpenWindow,
		openDesktopAppByComponent,
		switchToDesktop,
		updateDesktopWallpaper,
		recordRecentAppOnVirtualDesktop,
		addRecentFile,
		propertiesItem,
		setPropertiesItem,
		t,
	} = parts;

	const {
		workspaceProfiles,
		appCollections,
		contentShortcuts,
		assistantContextActions,
	} = expansion;

	const expansionLaunchActionsFullInput = React.useMemo(
		() =>
			buildDesktopWorkspaceExpansionLaunchActionsInput({
				items,
				installedApps,
				selected,
				activeDesktopId,
				activeDesktopWindow,
				windows,
				expansion: {
					workspaceProfiles,
					appCollections,
					contentShortcuts,
					assistantContextActions,
				},
				handleOpenWindow,
				openDesktopAppByComponent,
				switchToDesktop,
				updateDesktopWallpaper,
				recordRecentAppOnVirtualDesktop,
				addRecentFile,
				propertiesItem,
				setPropertiesItem,
				t,
			}),
		[
			activeDesktopId,
			activeDesktopWindow,
			addRecentFile,
			appCollections,
			assistantContextActions,
			contentShortcuts,
			handleOpenWindow,
			installedApps,
			items,
			openDesktopAppByComponent,
			propertiesItem,
			recordRecentAppOnVirtualDesktop,
			selected,
			setPropertiesItem,
			switchToDesktop,
			t,
			updateDesktopWallpaper,
			windows,
			workspaceProfiles,
		]
	);

	const expansionLaunch = useDesktopWorkspaceExpansionLaunchActions(
		expansionLaunchActionsFullInput
	);

	return { expansionLaunchActionsFullInput, expansionLaunch };
}
