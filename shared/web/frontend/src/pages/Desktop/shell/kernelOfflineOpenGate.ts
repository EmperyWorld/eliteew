/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave K6–K13: Kernel offline SPA subset — open gate + catalog filter when desktopNative+offline.
 *
 * Invariants:
 * - Online or non-desktopNative → never deny / never filter via this module.
 * - Shell install-profile exempts stay launchable and visible offline.
 * - Deny toast uses formatKernelOfflineSubsetNoticeRu (K14 user labels).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md
 */

import { toast } from 'sonner';
import { DESKTOP_NATIVE_FLAG_KEY } from '@/entries/setupDesktopNativeOidcProfile';
import type { DesktopItem } from '../types/desktop.types';
import { isInstallProfileExemptAppComponent } from '../utils/desktopInstallProfileFilter';
import {
	formatKernelOfflineSubsetNoticeRu,
	isKernelOfflineSpaSubsetAppId,
} from './kernelOfflineSpaDeepLink';

export function isDesktopNativeClientRuntime(): boolean {
	if (typeof window === 'undefined') return false;
	try {
		return (
			sessionStorage.getItem(DESKTOP_NATIVE_FLAG_KEY) === '1' ||
			localStorage.getItem(DESKTOP_NATIVE_FLAG_KEY) === '1'
		);
	} catch {
		return false;
	}
}

export function isBrowserOnline(): boolean {
	if (typeof navigator === 'undefined') return true;
	return navigator.onLine !== false;
}

/** True when Kernel offline SPA subset mode is active (K6/K7). */
export function isKernelOfflineSpaSubsetModeActive(opts?: {
	desktopNative?: boolean;
	online?: boolean;
}): boolean {
	const desktopNative = opts?.desktopNative ?? isDesktopNativeClientRuntime();
	if (!desktopNative) return false;
	const online = opts?.online ?? isBrowserOnline();
	return !online;
}

/**
 * Pure deny predicate for Kernel offline SPA subset (K6).
 */
export function shouldDenyOpenOutsideKernelOfflineSubset(opts: {
	appComponent: string;
	desktopNative?: boolean;
	online?: boolean;
}): boolean {
	const appComponent = opts.appComponent.trim();
	if (!appComponent) return false;
	if (isInstallProfileExemptAppComponent(appComponent)) return false;
	if (
		!isKernelOfflineSpaSubsetModeActive({
			desktopNative: opts.desktopNative,
			online: opts.online,
		})
	) {
		return false;
	}
	return !isKernelOfflineSpaSubsetAppId(appComponent);
}

/**
 * When denied, show honest toast and return true (caller should abort open).
 */
export function denyOpenOutsideKernelOfflineSubsetIfNeeded(
	appComponent: string
): boolean {
	if (
		!shouldDenyOpenOutsideKernelOfflineSubset({
			appComponent,
		})
	) {
		return false;
	}
	try {
		toast.error(formatKernelOfflineSubsetNoticeRu());
	} catch {
		/* toast must not throw into open handlers */
	}
	return true;
}

function keepItemInKernelOfflineSubset(
	appComponent: string | null | undefined
): boolean {
	if (!appComponent) return false;
	if (isInstallProfileExemptAppComponent(appComponent)) return true;
	return isKernelOfflineSpaSubsetAppId(appComponent);
}

/**
 * Wave K7: hide non-subset catalog rows while Kernel offline subset mode is active.
 */
export function filterDesktopItemsByKernelOfflineSubset(
	items: DesktopItem[],
	opts?: { desktopNative?: boolean; online?: boolean }
): DesktopItem[] {
	if (!isKernelOfflineSpaSubsetModeActive(opts)) return items;
	return items.filter((item) =>
		keepItemInKernelOfflineSubset(item.appComponent)
	);
}

type StoreAppRow = { app_component: string };

export function filterStoreAppsByKernelOfflineSubset<T extends StoreAppRow>(
	apps: T[],
	opts?: { desktopNative?: boolean; online?: boolean }
): T[] {
	if (!isKernelOfflineSpaSubsetModeActive(opts)) return apps;
	return apps.filter((app) => keepItemInKernelOfflineSubset(app.app_component));
}
