/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Props for shell-tab body clusters under `settings/expansion/`.
 *
 * Related:
 * - `DesktopSettingsExpansionShellCluster.tsx`
 */

import type { Dispatch, SetStateAction } from 'react';
import type { DesktopExpansionSettings } from '../../../types/desktopExpansion.types';
import type { DesktopSettingsCenterBridge } from '../../../types/desktopSettingsCenterBridge.types';
import type { SettingsNavigateTarget } from '../../../utils/desktopSettingsStorageMapNavigation';
import type {
	DesktopSettingsShellHelpers,
	DesktopSettingsWorkspaceProfilesShellContext,
	SavedFilterContentShortcutDraftState,
} from '../desktopSettingsShared.types';

export type DesktopSettingsExpansionShellClusterProps = {
	desktopOpenAppsMaximized: boolean;
	onDesktopOpenAppsMaximizedChange: (value: boolean) => void;
	expansionSettings: DesktopExpansionSettings;
	settingsCenterBridge: DesktopSettingsCenterBridge;
	shell: DesktopSettingsShellHelpers;
	workspaceProfilesShellContext?: DesktopSettingsWorkspaceProfilesShellContext;
	onStorageMapFieldNavigate?: (target: SettingsNavigateTarget) => void;
	savedFilterShortcutDraft: SavedFilterContentShortcutDraftState;
	setSavedFilterShortcutDraft: Dispatch<
		SetStateAction<SavedFilterContentShortcutDraftState>
	>;
};
