/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin entry for desktop window content — resolve registry key then mount.
 *
 * Invariants:
 * - Mount implementations live in shell/appMounts.resolve.tsx.
 * - Mount id catalog: shell/appMounts.registry.ts.
 *
 * Related:
 * - shell/appMounts.resolve.tsx
 * - shell/appMounts.registry.ts
 * - utils/desktopWindowResolveApp.ts
 */

import type * as React from 'react';
import type { DesktopAppPropsContextValue } from '../../context/DesktopAppPropsContext';
import type { WindowState } from '../../types/desktop.types';
import { resolveAppMount } from '../../shell/appMounts.resolve';
import { resolveDesktopWindowAppComponent } from '../../utils/desktopWindowResolveApp';
import type { DesktopWindowAppCallbacks } from './types';

export function getDesktopWindowAppContent(
	componentName?: string,
	appProps?: DesktopAppPropsContextValue | null,
	windowState?: WindowState,
	windowCallbacks?: DesktopWindowAppCallbacks
): React.ReactElement | React.ComponentType | null {
	const resolved = resolveDesktopWindowAppComponent(componentName, windowState);
	if (!resolved) {
		return null;
	}
	return resolveAppMount(resolved, appProps, windowState, windowCallbacks);
}
