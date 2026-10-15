/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Deferred voice command listeners for desktop shell (not desktop-interactive readiness).
 *
 * Invariants:
 * - Mounted only after `deferredRuntimeReady`.
 * - Renders nothing; registers global voice command handlers via effect.
 *
 * Related:
 * - useDesktopVoiceCommands.ts
 * - documentation/platform/FRONTEND-BOOT-ORCHESTRATION.md
 */

import { memo } from 'react';
import { useDesktopVoiceCommands } from '../hooks/useDesktopVoiceCommands';
import type { DesktopDeferredVoiceCommandsInput } from './desktopDeferredVoiceCommandsInput';

function DesktopDeferredVoiceCommandsRuntimeInner(
	input: DesktopDeferredVoiceCommandsInput
): null {
	useDesktopVoiceCommands({
		items: input.items,
		windows: input.windows,
		currentDesktopWindows: input.currentDesktopWindows,
		activeWindowId: input.activeWindowId,
		focusWindow: input.focusWindow,
		handleOpenWindow: input.handleOpenWindow,
		setShowNF: input.setShowNF,
		minimizeAllWindows: input.minimizeAllWindows,
		closeWindow: input.closeWindow,
		closeActiveWindow: input.closeActiveWindow,
		openCommandPalette: () => input.setShowCommandPalette(true),
	});

	return null;
}

export const DesktopDeferredVoiceCommandsRuntime = memo(
	DesktopDeferredVoiceCommandsRuntimeInner
);
