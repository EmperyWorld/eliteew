/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave 24: compose full Shell Layout bridge input from group builders.
 *
 * Related:
 * - buildCanvasAndInteractions.ts
 * - buildChromeAndModalsRest.ts
 * - buildDerived.ts
 * - hooks/useDesktopWorkspaceShellLayoutInputAssembly.ts
 */

import type { DesktopWorkspaceShellLayoutInputBridgeInput } from '../../hooks/useDesktopWorkspaceShellLayoutInputBridge';
import type { DesktopWorkspaceShellLayoutInputAssemblySources } from './desktopWorkspaceShellLayoutInputAssembly.types';
import { buildDesktopWorkspaceShellLayoutBridgeCanvasAndInteractions } from './buildCanvasAndInteractions';
import { buildDesktopWorkspaceShellLayoutBridgeChromeAndModalsRest } from './buildChromeAndModalsRest';
import { buildDesktopWorkspaceShellLayoutBridgeDerived } from './buildDerived';

export function buildDesktopWorkspaceShellLayoutInputBridgeInput(
	sources: DesktopWorkspaceShellLayoutInputAssemblySources
): DesktopWorkspaceShellLayoutInputBridgeInput {
	return {
		canvasAndInteractions:
			buildDesktopWorkspaceShellLayoutBridgeCanvasAndInteractions(sources),
		chromeAndModalsRest:
			buildDesktopWorkspaceShellLayoutBridgeChromeAndModalsRest(sources),
		derived: buildDesktopWorkspaceShellLayoutBridgeDerived(sources),
	};
}
