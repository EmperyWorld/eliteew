/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Provides presentation-only formatting, edge-sync resolution/aggregate, and
 * pairing completion detection for Mobile Hub.
 *
 * Invariants:
 * - A stale active device alone cannot complete a new pairing challenge.
 * - Edge sync UI status must not treat WG metadata readiness as server peer sync.
 * - Missing OTA SHA and empty active-device aggregates render honestly (em dash / zeros).
 *
 * Related:
 * - MobileHubOverviewGrid.tsx
 * - MobileHubTrustedDevicesPanel.tsx
 * - useMobileAppHubController.ts
 * - documentation/product/mobile/MOBILE-SECURE-CONNECTION-OPERATIONS.md
 */

import type { MobileTrustedDeviceItem } from '@/services/mobileAppApi';

export type TrustedDeviceEdgeSyncUiStatus =
	| 'synced'
	| 'pending'
	| 'failed'
	| 'manual_required'
	| 'unknown';

export function formatDt(iso: string | null | undefined): string {
	if (!iso) return '—';
	const value = new Date(iso);
	return Number.isNaN(value.getTime()) ? iso : value.toLocaleString();
}

export function formatMib(bytes: number | null | undefined): string {
	if (bytes == null || bytes <= 0) return '—';
	return `${(bytes / (1024 * 1024)).toFixed(1)} МиБ`;
}

export function humanizeMobileHistoryEventType(eventType: string): string {
	const normalized = eventType
		.replace(/[_-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return normalized || 'event';
}

/**
 * Resolve honest edge-sync status for Mobile Hub.
 * When the API omits the field, metadata-ready devices default to pending
 * (never "synced") so the UI cannot claim server readiness from phone config alone.
 */
export function resolveTrustedDeviceEdgeSyncStatus(
	device: MobileTrustedDeviceItem
): TrustedDeviceEdgeSyncUiStatus {
	const raw = (device.wg_edge_sync_status || '').trim().toLowerCase();
	if (
		raw === 'synced' ||
		raw === 'pending' ||
		raw === 'failed' ||
		raw === 'manual_required' ||
		raw === 'unknown'
	) {
		return raw;
	}
	const metadataReady = Boolean(
		device.wg_assigned_ip && device.wg_endpoint && device.wg_server_public_key
	);
	return metadataReady ? 'pending' : 'unknown';
}

/** Short hex preview for OTA SHA parity (never invent when missing). */
export function formatApkSha256Short(
	sha: string | null | undefined,
	head = 12
): string {
	const value = (sha || '').trim().toLowerCase();
	if (!value) return '—';
	if (value.length <= head) return value;
	return `${value.slice(0, head)}…`;
}

export type TrustedDeviceEdgeSyncAggregate = {
	activeCount: number;
	byStatus: Record<TrustedDeviceEdgeSyncUiStatus, number>;
	/** Worst status among active devices (failed > manual > pending > unknown > synced). */
	worstStatus: TrustedDeviceEdgeSyncUiStatus | null;
	/** Latest wg_edge_synced_at among active devices (Celery sync hint). */
	lastSyncedAt: string | null;
};

const EDGE_SYNC_WORST_RANK: Record<TrustedDeviceEdgeSyncUiStatus, number> = {
	failed: 5,
	manual_required: 4,
	pending: 3,
	unknown: 2,
	synced: 1,
};

/**
 * Aggregate edge-sync honesty for the current user's trusted devices.
 * Counts only active rows; lastSyncedAt is the newest non-empty wg_edge_synced_at.
 */
export function aggregateTrustedDeviceEdgeSync(
	devices: MobileTrustedDeviceItem[]
): TrustedDeviceEdgeSyncAggregate {
	const byStatus: Record<TrustedDeviceEdgeSyncUiStatus, number> = {
		synced: 0,
		pending: 0,
		failed: 0,
		manual_required: 0,
		unknown: 0,
	};
	let activeCount = 0;
	let worstStatus: TrustedDeviceEdgeSyncUiStatus | null = null;
	let lastSyncedAt: string | null = null;
	let lastSyncedMs = Number.NEGATIVE_INFINITY;

	for (const device of devices) {
		if ((device.status || '').trim().toLowerCase() !== 'active') continue;
		activeCount += 1;
		const status = resolveTrustedDeviceEdgeSyncStatus(device);
		byStatus[status] += 1;
		if (
			worstStatus == null ||
			EDGE_SYNC_WORST_RANK[status] > EDGE_SYNC_WORST_RANK[worstStatus]
		) {
			worstStatus = status;
		}
		const syncedAt = (device.wg_edge_synced_at || '').trim();
		if (!syncedAt) continue;
		const ms = new Date(syncedAt).getTime();
		if (!Number.isFinite(ms)) continue;
		if (ms >= lastSyncedMs) {
			lastSyncedMs = ms;
			lastSyncedAt = syncedAt;
		}
	}

	return { activeCount, byStatus, worstStatus, lastSyncedAt };
}

export function pairingBindDetectedAfterChallenge(
	devices: MobileTrustedDeviceItem[],
	issuedAtMs: number,
	baselineDeviceIds: Set<string>
): boolean {
	return devices.some((device) => {
		const approvedMs = device.approved_at
			? new Date(device.approved_at).getTime()
			: 0;
		if (
			Number.isFinite(approvedMs) &&
			approvedMs > 0 &&
			approvedMs >= issuedAtMs - 15_000
		) {
			return true;
		}
		return !baselineDeviceIds.has(device.id);
	});
}
