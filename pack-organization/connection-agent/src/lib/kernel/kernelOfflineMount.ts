/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave K2–K8: Kernel-offline mount helpers — policy from @eliteew/kernel-offline-policy + spa_deep_link URLs.
 *
 * Invariants:
 * - Fail-closed unknown app ids; presentation_url requires path.
 * - spa_deep_link opens cloud Desktop via product_open (not kernel Webview).
 * - Policy SoT is EliteEW/shared/kernel-offline/kernelOfflineMounts.policy.json (via package).
 *
 * Related:
 * - @eliteew/kernel-offline-policy
 * - documentation/product/desktop/DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md
 */

import {
	SPA_OPEN_APP_QUERY,
	buildKernelOfflineMountUrl,
	getKernelOfflineMountEntry,
	isOfflineSpaSubsetMount,
	isPresentationUrlMount,
	isSpaDeepLinkMount,
	kernelOfflineCatalogHint,
	offlineSpaSubsetMountIds,
	presentationUrlMountIds,
	spaDeepLinkMountIds,
	KERNEL_OFFLINE_MOUNTS_POLICY,
	type KernelOfflineMountEntry,
	type KernelOfflineMountMode,
	type KernelOfflineMountsPolicy,
} from '@eliteew/kernel-offline-policy';
import { buildProductStartUrl } from '../launcher/productStart';

export {
	SPA_OPEN_APP_QUERY,
	buildKernelOfflineMountUrl,
	getKernelOfflineMountEntry,
	isOfflineSpaSubsetMount,
	isPresentationUrlMount,
	isSpaDeepLinkMount,
	kernelOfflineCatalogHint,
	offlineSpaSubsetMountIds,
	presentationUrlMountIds,
	spaDeepLinkMountIds,
	KERNEL_OFFLINE_MOUNTS_POLICY,
};
export type {
	KernelOfflineMountEntry,
	KernelOfflineMountMode,
	KernelOfflineMountsPolicy,
};

/**
 * Cloud Desktop Start URL with desktopNative + eliteewOpenApp for spa_deep_link mounts.
 */
export function buildSpaDeepLinkStartUrl(
	appBase: string,
	appId: string
): string | null {
	const id = appId.trim();
	if (!id || !isSpaDeepLinkMount(id)) {
		return null;
	}
	try {
		const url = new URL(buildProductStartUrl(appBase));
		url.searchParams.set(SPA_OPEN_APP_QUERY, id);
		return url.toString();
	} catch {
		return null;
	}
}
