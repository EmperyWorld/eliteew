/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Stable empty companion bridge for critical Desktop shell first paint.
 *
 * Related:
 * - DesktopDeferredCompanionRuntime.tsx
 * - context/EwaCompanionShellBridgeContext.tsx
 */

import type { EwaCompanionShellBridgeValue } from '../context/EwaCompanionShellBridgeContext';

export const EMPTY_EWA_COMPANION_SHELL_BRIDGE: EwaCompanionShellBridgeValue = {
	getSnapshot: () => null,
};
