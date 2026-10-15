/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Window persistence and snap geometry helpers for expansion layout presets.
 *
 * Invariants:
 * - persistableWindow sanitizes initialPayload before shell PATCH.
 *
 * Related:
 * - useDesktopExpansionWindowLayoutActions.ts
 * - utils/sanitizePersistedDesktopWindowPayload.ts
 */

import type {
	PersistedWindowState,
	WindowState,
} from '../../types/desktop.types';
import { readDesktopWorkArea } from '../../utils/desktopSnapGeometry';
import { sanitizeWindowPayloadForShellPersistence } from '../../utils/sanitizePersistedDesktopWindowPayload';

export function persistableWindow(
	w: WindowState,
	desktopId: string
): PersistedWindowState {
	return {
		folderId: w.folderId,
		path: w.path,
		appComponent: w.appComponent,
		title: w.title,
		type: w.type,
		position: w.position,
		size: w.size,
		isMinimized: w.isMinimized,
		isMaximized: w.isMaximized,
		zIndex: w.zIndex,
		desktopId,
		initialPayload: sanitizeWindowPayloadForShellPersistence(w.initialPayload),
	};
}

/** Как `getMaximizedWindowBounds` в `useWindowManager` — размер зоны snap. */
export function layoutWorkSizeFromDom(): { width: number; height: number } {
	const wa = readDesktopWorkArea();
	return {
		width: Math.max(320, wa.width),
		height: Math.max(240, wa.height),
	};
}
