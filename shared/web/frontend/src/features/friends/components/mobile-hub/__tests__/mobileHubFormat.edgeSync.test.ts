/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock honest edge-sync status resolution and OTA SHA/aggregate helpers for Mobile Hub.
 *
 * Invariants:
 * - Metadata-ready without wg_edge_sync_status must not resolve as synced.
 * - Edge aggregate counts only active devices; missing SHA renders as em dash.
 *
 * Related:
 * - ../mobileHubFormat.ts
 * - documentation/product/mobile/MOBILE-SECURE-CONNECTION-OPERATIONS.md
 */

import { describe, expect, it } from 'vitest';
import type { MobileTrustedDeviceItem } from '@/services/mobileAppApi';
import {
	aggregateTrustedDeviceEdgeSync,
	formatApkSha256Short,
	resolveTrustedDeviceEdgeSyncStatus,
} from '../mobileHubFormat';

function device(
	overrides: Partial<MobileTrustedDeviceItem> = {}
): MobileTrustedDeviceItem {
	return {
		id: 'dev-1',
		stable_device_id: 'phone-1',
		device_label: 'Test Phone',
		platform: 'android',
		status: 'active',
		device_public_key_fingerprint: 'abc',
		wg_public_key_fingerprint: 'def',
		wg_assigned_ip: '10.88.88.2',
		wg_allowed_ips: null,
		wg_dns: null,
		wg_endpoint: 'vpn.example:51822',
		wg_server_public_key: 'server-key',
		gaf_public_key_fingerprint: null,
		approved_at: '2026-07-16T00:00:00Z',
		revoked_at: null,
		last_seen_at: null,
		created_at: '2026-07-16T00:00:00Z',
		updated_at: '2026-07-16T00:00:00Z',
		...overrides,
	};
}

describe('resolveTrustedDeviceEdgeSyncStatus', () => {
	it('passes through API statuses', () => {
		expect(
			resolveTrustedDeviceEdgeSyncStatus(
				device({ wg_edge_sync_status: 'synced' })
			)
		).toBe('synced');
		expect(
			resolveTrustedDeviceEdgeSyncStatus(
				device({ wg_edge_sync_status: 'failed' })
			)
		).toBe('failed');
		expect(
			resolveTrustedDeviceEdgeSyncStatus(
				device({ wg_edge_sync_status: 'manual_required' })
			)
		).toBe('manual_required');
	});

	it('defaults metadata-ready devices without status to pending (never synced)', () => {
		expect(
			resolveTrustedDeviceEdgeSyncStatus(device({ wg_edge_sync_status: null }))
		).toBe('pending');
		expect(
			resolveTrustedDeviceEdgeSyncStatus(
				device({ wg_edge_sync_status: undefined })
			)
		).toBe('pending');
	});

	it('defaults incomplete metadata to unknown', () => {
		expect(
			resolveTrustedDeviceEdgeSyncStatus(
				device({
					wg_assigned_ip: null,
					wg_endpoint: null,
					wg_server_public_key: null,
					wg_edge_sync_status: null,
				})
			)
		).toBe('unknown');
	});
});

describe('formatApkSha256Short', () => {
	it('returns em dash for missing sha', () => {
		expect(formatApkSha256Short(null)).toBe('—');
		expect(formatApkSha256Short('')).toBe('—');
	});

	it('truncates long digests', () => {
		expect(
			formatApkSha256Short(
				'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
			)
		).toBe('abcdef012345…');
	});
});

describe('aggregateTrustedDeviceEdgeSync', () => {
	it('counts only active devices and picks worst status + newest sync time', () => {
		const result = aggregateTrustedDeviceEdgeSync([
			device({
				id: 'a',
				wg_edge_sync_status: 'synced',
				wg_edge_synced_at: '2026-07-16T01:00:00Z',
			}),
			device({
				id: 'b',
				wg_edge_sync_status: 'pending',
				wg_edge_synced_at: '2026-07-16T03:00:00Z',
			}),
			device({
				id: 'revoked',
				status: 'revoked',
				wg_edge_sync_status: 'failed',
				wg_edge_synced_at: '2026-07-16T04:00:00Z',
			}),
		]);
		expect(result.activeCount).toBe(2);
		expect(result.byStatus.synced).toBe(1);
		expect(result.byStatus.pending).toBe(1);
		expect(result.byStatus.failed).toBe(0);
		expect(result.worstStatus).toBe('pending');
		expect(result.lastSyncedAt).toBe('2026-07-16T03:00:00Z');
	});

	it('returns empty aggregate when no active devices', () => {
		const result = aggregateTrustedDeviceEdgeSync([
			device({ status: 'revoked', wg_edge_sync_status: 'synced' }),
		]);
		expect(result.activeCount).toBe(0);
		expect(result.worstStatus).toBeNull();
		expect(result.lastSyncedAt).toBeNull();
	});
});
