/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 24: thin Shell Layout Input Assembly entry — Sources type re-export +
 * bridge compose → layout input bridge hook.
 *
 * Invariants:
 * - Must not re-own the nested bridge literal (lives in utils bridge builders).
 *
 * Related:
 * - utils/desktopWorkspaceShellLayoutBridgeInput/buildDesktopWorkspaceShellLayoutInputBridgeInput.ts
 * - utils/desktopWorkspaceShellLayoutInputAssemblyFromTail.ts
 * - hooks/useDesktopWorkspaceContentTailCluster.ts
 */

import { useDesktopWorkspaceShellLayoutInputBridge } from './useDesktopWorkspaceShellLayoutInputBridge';
import type { DesktopWorkspaceShellModalsAndLayoutSlotsClusterParams } from './useDesktopWorkspaceShellModalsAndLayoutSlotsCluster';
import { buildDesktopWorkspaceShellLayoutInputBridgeInput } from '../utils/desktopWorkspaceShellLayoutBridgeInput/buildDesktopWorkspaceShellLayoutInputBridgeInput';
import type { DesktopWorkspaceShellLayoutInputAssemblySources } from '../utils/desktopWorkspaceShellLayoutBridgeInput/desktopWorkspaceShellLayoutInputAssembly.types';

export type { DesktopWorkspaceShellLayoutInputAssemblySources };
export type { DesktopWorkspaceShellLayoutInputBridgeInput } from './useDesktopWorkspaceShellLayoutInputBridge';

/** Named assembly entry for Content/tail cluster. */
export function useDesktopWorkspaceShellLayoutInputAssembly(
	sources: DesktopWorkspaceShellLayoutInputAssemblySources
): DesktopWorkspaceShellModalsAndLayoutSlotsClusterParams {
	return useDesktopWorkspaceShellLayoutInputBridge(
		buildDesktopWorkspaceShellLayoutInputBridgeInput(sources)
	);
}
