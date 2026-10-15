/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave K8–K13: shared Kernel-offline policy helpers for SPA + desktop-client (private package).
 *
 * Invariants:
 * - SoT JSON is EliteEW/shared/kernel-offline/…; package embeds a sync copy at src/*.policy.json.
 * - Consumers resolve via pnpm workspace:* (FE + desktop-client), not public npm.
 * - Mode spa_offline_only = SPA subset beyond O5 pack (no Tauri local panel; no spa_deep_link).
 * - Offline UX notice must distinguish O5 pack vs spa_offline_only with user labels (K13–K17).
 * - label_ru is preferred for Start Menu / toast copy; never show Kernel/SPA ops jargon.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md
 */

import policyJson from './kernelOfflineMounts.policy.json';

/** Query param consumed by SPA (desktopNative) to open a mount after Desktop ready. */
export const SPA_OPEN_APP_QUERY = 'eliteewOpenApp';

export type KernelOfflineMountMode =
	| 'presentation_url'
	| 'o5_panel_only'
	| 'spa_offline_only';

export type KernelOfflineMountEntry = {
	mode: KernelOfflineMountMode;
	path?: string;
	window_title?: string;
	spa_deep_link?: boolean;
	offline_spa_subset?: boolean;
	/** Short user-facing RU label for offline notice / catalog (K14+). */
	label_ru?: string;
	catalog_hint_ru?: string;
};

export type KernelOfflineMountsPolicy = {
	schema_version: number;
	wave: string;
	description?: string;
	mounts: Record<string, KernelOfflineMountEntry>;
};

export const KERNEL_OFFLINE_MOUNTS_POLICY =
	policyJson as KernelOfflineMountsPolicy;

export function getKernelOfflineMountEntry(
	appId: string
): KernelOfflineMountEntry | null {
	const entry = KERNEL_OFFLINE_MOUNTS_POLICY.mounts[appId.trim()];
	return entry ?? null;
}

export function isPresentationUrlMount(appId: string): boolean {
	return getKernelOfflineMountEntry(appId)?.mode === 'presentation_url';
}

export function isKernelOfflineSpaDeepLinkAppId(id: string): boolean {
	return getKernelOfflineMountEntry(id)?.spa_deep_link === true;
}

export function isKernelOfflineSpaSubsetAppId(id: string): boolean {
	return getKernelOfflineMountEntry(id)?.offline_spa_subset === true;
}

/** @deprecated Prefer isKernelOfflineSpaDeepLinkAppId — alias for desktop-client. */
export function isSpaDeepLinkMount(appId: string): boolean {
	return isKernelOfflineSpaDeepLinkAppId(appId);
}

/** @deprecated Prefer isKernelOfflineSpaSubsetAppId — alias for desktop-client. */
export function isOfflineSpaSubsetMount(appId: string): boolean {
	return isKernelOfflineSpaSubsetAppId(appId);
}

export function kernelOfflineCatalogHint(appId: string): string {
	const entry = getKernelOfflineMountEntry(appId);
	if (entry?.catalog_hint_ru) return entry.catalog_hint_ru;
	return 'На устройстве';
}

export function kernelOfflineLabelRu(appId: string): string {
	const entry = getKernelOfflineMountEntry(appId);
	const label = (entry?.label_ru || '').trim();
	if (label) return label;
	return appId.trim() || 'Приложение';
}

function labelsForIds(ids: string[]): string[] {
	return ids.map((id) => kernelOfflineLabelRu(id));
}

export const KERNEL_OFFLINE_SPA_DEEP_LINK_APP_IDS = Object.entries(
	KERNEL_OFFLINE_MOUNTS_POLICY.mounts
)
	.filter(([, e]) => e.spa_deep_link === true)
	.map(([id]) => id)
	.sort() as readonly string[];

export const KERNEL_OFFLINE_SPA_SUBSET_APP_IDS = Object.entries(
	KERNEL_OFFLINE_MOUNTS_POLICY.mounts
)
	.filter(([, e]) => e.offline_spa_subset === true)
	.map(([id]) => id)
	.sort() as readonly string[];

export function presentationUrlMountIds(): string[] {
	return Object.entries(KERNEL_OFFLINE_MOUNTS_POLICY.mounts)
		.filter(([, e]) => e.mode === 'presentation_url')
		.map(([id]) => id)
		.sort();
}

export function spaDeepLinkMountIds(): string[] {
	return [...KERNEL_OFFLINE_SPA_DEEP_LINK_APP_IDS];
}

export function offlineSpaSubsetMountIds(): string[] {
	return [...KERNEL_OFFLINE_SPA_SUBSET_APP_IDS];
}

export function isSpaOfflineOnlyMount(appId: string): boolean {
	return getKernelOfflineMountEntry(appId)?.mode === 'spa_offline_only';
}

export function spaOfflineOnlyMountIds(): string[] {
	return Object.entries(KERNEL_OFFLINE_MOUNTS_POLICY.mounts)
		.filter(([, e]) => e.mode === 'spa_offline_only')
		.map(([id]) => id)
		.sort();
}

/** Wave K13–K17: O5 pack vs spa_offline_only counts for honest offline UX. */
export type KernelOfflineSubsetBreakdown = {
	o5PackCount: number;
	spaOfflineOnlyCount: number;
	subsetTotal: number;
	/** User-facing RU labels for device (O5) pack apps. */
	o5PackLabelsRu: string[];
	/** User-facing RU labels for spa_offline_only apps. */
	spaOfflineOnlyLabelsRu: string[];
};

export function kernelOfflineSubsetBreakdown(): KernelOfflineSubsetBreakdown {
	const spaOnlyIds = spaOfflineOnlyMountIds();
	const subsetIds = offlineSpaSubsetMountIds();
	const spaOfflineOnlyCount = spaOnlyIds.length;
	const subsetTotal = subsetIds.length;
	const o5PackIds = subsetIds.filter((id) => !isSpaOfflineOnlyMount(id));
	return {
		o5PackCount: subsetTotal - spaOfflineOnlyCount,
		spaOfflineOnlyCount,
		subsetTotal,
		o5PackLabelsRu: labelsForIds(o5PackIds),
		spaOfflineOnlyLabelsRu: labelsForIds(spaOnlyIds),
	};
}

/** Russian Start Menu / toast-adjacent copy for offline subset mode (K14+ labels). */
export function formatKernelOfflineSubsetNoticeRu(): string {
	const {
		o5PackLabelsRu,
		spaOfflineOnlyLabelsRu,
		o5PackCount,
		spaOfflineOnlyCount,
	} = kernelOfflineSubsetBreakdown();
	const device =
		o5PackLabelsRu.length > 0 ? o5PackLabelsRu.join(', ') : `${o5PackCount}`;
	const spa =
		spaOfflineOnlyLabelsRu.length > 0
			? spaOfflineOnlyLabelsRu.join(', ')
			: `${spaOfflineOnlyCount}`;
	return `Офлайн сейчас: на устройстве — ${device}; в рабочем столе — ${spa}.`;
}

/**
 * Build http(s) URL for presentation_url mounts only.
 */
export function buildKernelOfflineMountUrl(
	appBase: string,
	appId: string
): string | null {
	const base = appBase.trim().replace(/\/+$/, '');
	const entry = getKernelOfflineMountEntry(appId);
	if (!base || !entry || entry.mode !== 'presentation_url') {
		return null;
	}
	const path = (entry.path ?? '').trim();
	if (!path.startsWith('/')) {
		return null;
	}
	return `${base}${path}`;
}
