/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Input contract for deferred companion rail + shell bridge runtime.
 *
 * Related:
 * - DesktopDeferredCompanionRuntime.tsx
 */

import type * as React from 'react';
import type { VirtualDesktop } from '../hooks/useVirtualDesktops';
import type { DesktopItem, WindowState } from '../types/desktop.types';
import type { DesktopWorkspaceExpansionLaunchActionsInput } from '../types/desktopWorkspaceExpansionLaunchActions.types';

export type DesktopDeferredCompanionInput = {
	isMobile: boolean;
	items: readonly DesktopItem[];
	selected: ReadonlySet<string>;
	activeDesktopWindow: WindowState | null | undefined;
	windowsRef:
		| React.RefObject<WindowState[] | null | undefined>
		| React.MutableRefObject<WindowState[]>;
	desktops: readonly VirtualDesktop[];
	activeDesktopId: string;
	activeDesktopWindowId: string | null | undefined;
	expansionLaunchActionsInput: Omit<
		DesktopWorkspaceExpansionLaunchActionsInput,
		'expansion'
	>;
};
