/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Deferred companion rail + EWA shell bridge engine. Renders nothing; writes context.
 *
 * Invariants:
 * - Mounted only after `deferredRuntimeReady`.
 * - Uses live expansion + launch actions from deferred expansion context.
 *
 * Related:
 * - DesktopDeferredCompanionContext.tsx
 * - documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md
 */

import { memo, useLayoutEffect } from 'react';
import {
	useSetDesktopDeferredCompanion,
	type DesktopDeferredCompanionState,
} from '../context/DesktopDeferredCompanionContext';
import { useDesktopDeferredExpansion } from '../context/DesktopDeferredExpansionContext';
import { useDesktopWorkspaceExpansionLaunchActions } from '../hooks/useDesktopWorkspaceExpansionLaunchActions';
import { useDesktopWorkspaceContentOrchestration } from '../hooks/useDesktopWorkspaceContentOrchestration';
import { EMPTY_EWA_COMPANION_SHELL_BRIDGE } from './desktopDeferredCompanion';
import type { DesktopDeferredCompanionInput } from './desktopDeferredCompanionInput';

function desktopDeferredCompanionEqual(
	left: DesktopDeferredCompanionState,
	right: DesktopDeferredCompanionState
): boolean {
	return (
		left.companionShellBridge === right.companionShellBridge &&
		left.assistantSelectionRail === right.assistantSelectionRail
	);
}

function DesktopDeferredCompanionRuntimeInner(
	input: DesktopDeferredCompanionInput
): null {
	const setCompanion = useSetDesktopDeferredCompanion();
	const expansion = useDesktopDeferredExpansion();
	const { openAssistantContextAction } = useDesktopWorkspaceExpansionLaunchActions(
		{
			...input.expansionLaunchActionsInput,
			expansion: {
				workspaceProfiles: expansion.workspaceProfiles,
				appCollections: expansion.appCollections,
				contentShortcuts: expansion.contentShortcuts,
				assistantContextActions: expansion.assistantContextActions,
			},
		}
	);
	const { assistantSelectionRail, companionShellBridge } =
		useDesktopWorkspaceContentOrchestration({
			isMobile: input.isMobile,
			items: input.items,
			selected: input.selected,
			assistantContextActions: expansion.assistantContextActions,
			openAssistantContextAction,
			activeDesktopWindow: input.activeDesktopWindow,
			windowsRef: input.windowsRef,
			desktops: input.desktops,
			activeDesktopId: input.activeDesktopId,
			activeDesktopWindowId: input.activeDesktopWindowId,
		});

	useLayoutEffect(() => {
		setCompanion((prev) => {
			const next: DesktopDeferredCompanionState = {
				assistantSelectionRail,
				companionShellBridge,
			};
			return desktopDeferredCompanionEqual(prev, next) ? prev : next;
		});
	}, [assistantSelectionRail, companionShellBridge, setCompanion]);

	useLayoutEffect(
		() => () => {
			setCompanion({
				companionShellBridge: EMPTY_EWA_COMPANION_SHELL_BRIDGE,
				assistantSelectionRail: null,
			});
		},
		[setCompanion]
	);

	return null;
}

export const DesktopDeferredCompanionRuntime = memo(
	DesktopDeferredCompanionRuntimeInner
);
