/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave K5–K8: SPA re-exports Kernel-offline policy helpers from @eliteew/kernel-offline-policy.
 *
 * Invariants:
 * - SoT remains host/kernel-offline/kernelOfflineMounts.policy.json (via package).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md
 */

export {
	SPA_OPEN_APP_QUERY,
	KERNEL_OFFLINE_SPA_DEEP_LINK_APP_IDS,
	KERNEL_OFFLINE_SPA_SUBSET_APP_IDS,
	isKernelOfflineSpaDeepLinkAppId,
	isKernelOfflineSpaSubsetAppId,
	formatKernelOfflineSubsetNoticeRu,
	kernelOfflineSubsetBreakdown,
	spaOfflineOnlyMountIds,
} from '@eliteew/kernel-offline-policy';
