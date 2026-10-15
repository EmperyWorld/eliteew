/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * One-shot: after redirect from legacy full-page route, open queued app or store UGS deep link.
 * Must run before {@link useDesktopUgsDeepLinkEffects} so `storeUgsDesktopDeepLink` runs first.
 *
 * Invariants:
 * - P8: do not clear pending app open until installed catalog is ready and intent is accepted or terminal-missed.
 * - Launch resolves from shortcuts **or** installed catalog (not icons-only).
 *
 * Related:
 * - utils/pendingDesktopOpen.ts
 * - utils/desktopAppRegistry.ts (`resolveDesktopAppLaunchItem`)
 */

import { useEffect, useRef } from 'react';
import type { DesktopItem } from '../types/desktop.types';
import {
	canDisplayDesktopItem,
	resolveDesktopAppItem,
	resolveDesktopAppLaunchItem,
} from '../utils/desktopAppRegistry';
import {
	clearPendingDesktopOpen,
	peekPendingDesktopOpen,
} from '../utils/pendingDesktopOpen';
import { storeUgsDesktopDeepLink } from '../utils/ugsDesktopDeepLink';
import { denyOpenOutsideKernelOfflineSubsetIfNeeded } from '../shell/kernelOfflineOpenGate';
import type { OpenWindowOptions } from './useWindowManager';

export function useLegacyPendingDesktopOpenEffect(params: {
	items: DesktopItem[];
	installedApps: DesktopItem[];
	installedAppIds: ReadonlySet<string>;
	/** When true, keep pending app open in sessionStorage until catalog arrives. */
	installedAppsLoading?: boolean;
	handleOpenWindow: (item: DesktopItem, options?: OpenWindowOptions) => void;
}): void {
	const {
		items,
		installedApps,
		installedAppIds,
		installedAppsLoading = false,
		handleOpenWindow,
	} = params;
	const consumedRef = useRef(false);

	useEffect(() => {
		if (consumedRef.current) {
			return;
		}
		const pending = peekPendingDesktopOpen();
		if (!pending) {
			return;
		}
		if (pending.kind === 'ugs') {
			clearPendingDesktopOpen();
			consumedRef.current = true;
			storeUgsDesktopDeepLink(pending.rawTarget);
			return;
		}
		if (installedAppsLoading) {
			return;
		}
		if (denyOpenOutsideKernelOfflineSubsetIfNeeded(pending.appComponent)) {
			clearPendingDesktopOpen();
			consumedRef.current = true;
			return;
		}
		const item = resolveDesktopAppLaunchItem(pending.appComponent, {
			items,
			installedApps,
		});
		if (!item) {
			clearPendingDesktopOpen();
			consumedRef.current = true;
			return;
		}
		const resolved = resolveDesktopAppItem(item, installedApps);
		if (!canDisplayDesktopItem(resolved, installedAppIds)) {
			clearPendingDesktopOpen();
			consumedRef.current = true;
			return;
		}
		clearPendingDesktopOpen();
		consumedRef.current = true;
		handleOpenWindow(resolved);
	}, [
		handleOpenWindow,
		installedAppIds,
		installedApps,
		installedAppsLoading,
		items,
	]);
}
