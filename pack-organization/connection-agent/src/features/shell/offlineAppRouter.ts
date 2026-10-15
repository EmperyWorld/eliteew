/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * O5: map entitlement app ids to offline local panels (no SPA Kernel mount).
 *
 * Invariants:
 * - Unknown ids → unavailable (honest deny).
 * - Only client-offline-ai pack set is openable offline.
 * - PACK_OFFLINE_APP_IDS must stay ⊆ SPA APP_MOUNTED_COMPONENTS (parity script).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
 */

export type OfflineAppPanelId =
	| 'ProjectAboutApp'
	| 'ClipboardManager'
	| 'NotificationsApp'
	| 'MusicPlayer'
	| 'unavailable';

/** Pack allowlist — keep sorted; parity gate reads this export shape via script. */
export const PACK_OFFLINE_APP_IDS = [
	'ClipboardManager',
	'MusicPlayer',
	'NotificationsApp',
	'ProjectAboutApp',
] as const;

const PACK_OFFLINE_APPS = new Set<string>(PACK_OFFLINE_APP_IDS);

export function resolveOfflineAppPanel(appId: string): OfflineAppPanelId {
	const id = appId.trim();
	if (PACK_OFFLINE_APPS.has(id)) {
		return id as Exclude<OfflineAppPanelId, 'unavailable'>;
	}
	return 'unavailable';
}

export function offlineAppLabel(appId: string): string {
	switch (appId) {
		case 'ProjectAboutApp':
			return 'О приложении';
		case 'ClipboardManager':
			return 'Буфер обмена';
		case 'NotificationsApp':
			return 'Уведомления';
		case 'MusicPlayer':
			return 'Музыка';
		default:
			return appId;
	}
}

export function isPackOfflineApp(appId: string): boolean {
	return PACK_OFFLINE_APPS.has(appId.trim());
}
