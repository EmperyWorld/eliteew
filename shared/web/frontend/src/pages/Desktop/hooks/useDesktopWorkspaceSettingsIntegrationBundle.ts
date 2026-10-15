/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 20 Settings Integration Bundle — public TailCluster entry for Settings Center
 * visual + persistence assembly → surface chrome facade outputs.
 *
 * Invariants:
 * - Same runtime path as T35 ClusterInput (builders → integration → facade).
 * - No second Settings Center bridge or window manager.
 *
 * Related:
 * - utils/desktopWorkspaceSettingsIntegrationSlices.ts
 * - documentation/product/desktop/DESKTOP-SETTINGS-CENTER-AND-EXPANSION-DESIGN.md
 */

import type { DesktopWorkspaceVoiceSettingsCenterClusterResult } from '../types/desktopWorkspaceVoiceSettingsCenterCluster.types';
import type { DesktopWorkspaceVoiceSettingsCenterClusterSources } from './useDesktopWorkspaceVoiceSettingsCenterClusterInput';
import { useDesktopWorkspaceVoiceSettingsCenterClusterInput } from './useDesktopWorkspaceVoiceSettingsCenterClusterInput';

export type DesktopWorkspaceSettingsIntegrationBundleSources =
	DesktopWorkspaceVoiceSettingsCenterClusterSources;

export type DesktopWorkspaceSettingsIntegrationBundleResult =
	DesktopWorkspaceVoiceSettingsCenterClusterResult;

/**
 * Compose Settings Center integration + surface chrome for the workspace TailCluster.
 * Wave 20 public name for the former VoiceSettingsCenterClusterInput call site.
 */
export function useDesktopWorkspaceSettingsIntegrationBundle(
	sources: DesktopWorkspaceSettingsIntegrationBundleSources
): DesktopWorkspaceSettingsIntegrationBundleResult {
	return useDesktopWorkspaceVoiceSettingsCenterClusterInput(sources);
}
