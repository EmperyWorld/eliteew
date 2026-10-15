/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * API client for authenticated mobile APK distribution and SSO visibility.
 *
 * Invariants:
 * - Direct APK file URL is short-lived and ticketed, with strict server-side replay limits.
 * - Trusted-device and overview GETs always bypass browser cache (no-store request + cache-bust query).
 *
 * Related:
 * - api/routers/mobile_app.py
 * - features/friends/components/MobileAppHubPanel.tsx
 */

import { apiClient } from '@/services/api/client';

/** Prevent browser/proxy reuse of session-scoped mobile hub JSON. */
function mobileSessionScopedGetConfig() {
	return {
		params: { _: Date.now() },
		headers: {
			'Cache-Control': 'no-cache, no-store',
			Pragma: 'no-cache',
		},
	};
}

export interface MobileAppSsoSnapshot {
	active: boolean;
	live: boolean;
	client_id: string | null;
	last_seen_at: string | null;
	first_seen_at: string | null;
	ip_address: string | null;
	user_agent: string | null;
}

export interface MobileAppLoginHistoryItem {
	event_type: string;
	created_at: string;
	ip_address: string | null;
	user_agent: string | null;
	client_id: string | null;
}

export interface MobileAppOverview {
	download_page_url: string;
	download_api_path: string;
	apk_available: boolean;
	apk_size_bytes: number | null;
	version_code: number | null;
	version_name: string | null;
	/** Lowercase SHA-256 of the published APK (OTA sidecar/manifest). */
	apk_sha256?: string | null;
	/** ISO timestamp from the OTA publish sidecar/manifest. */
	published_at?: string | null;
	release_notes?: string | null;
	min_supported_version_code?: number | null;
	last_login_at: string | null;
	login_count: number | null;
	mobile_session: MobileAppSsoSnapshot | null;
	login_history: MobileAppLoginHistoryItem[];
}

export interface MobileAppDownloadTicket {
	download_url: string;
	expires_in_seconds: number;
}

export interface MobileTrustedDeviceItem {
	id: string;
	stable_device_id: string;
	device_label: string;
	platform: string;
	status: string;
	device_public_key_fingerprint: string;
	wg_public_key_fingerprint: string;
	wg_assigned_ip: string | null;
	wg_allowed_ips: string | null;
	wg_dns: string | null;
	wg_endpoint: string | null;
	wg_server_public_key: string | null;
	gaf_public_key_fingerprint: string | null;
	approved_at: string | null;
	revoked_at: string | null;
	last_seen_at: string | null;
	created_at: string;
	updated_at: string;
	/** Edge peer reconcile honesty — not the same as WG metadata ready. */
	wg_edge_sync_status?: string | null;
	wg_edge_synced_at?: string | null;
}

export interface MobileTrustedDeviceListResponse {
	items: MobileTrustedDeviceItem[];
}

export interface MobilePairingChallengeResponse {
	challenge_id: string;
	pairing_code: string;
	challenge_nonce: string;
	expires_at: string;
	qr_payload: Record<string, unknown>;
}

export interface MobileDeviceAuditEventItem {
	id: number;
	event_type: string;
	result: string;
	device_id: string | null;
	created_at: string;
	ip_address: string | null;
	user_agent: string | null;
	details: Record<string, unknown>;
}

export interface MobileDeviceAuditEventListResponse {
	items: MobileDeviceAuditEventItem[];
}

export interface MobileDeviceTransferItem {
	id: string;
	user_id: string;
	old_device_id: string | null;
	new_device_id: string | null;
	status: string;
	transfer_public_key_fingerprint: string;
	transfer_public_key_algorithm: string;
	has_encrypted_transfer_blob: boolean;
	encrypted_transfer_blob_metadata: Record<string, unknown>;
	old_device_confirmed_at: string | null;
	admin_approved_by: string | null;
	admin_approved_at: string | null;
	email_confirmed_at: string | null;
	completed_at: string | null;
	expires_at: string;
	created_at: string;
	updated_at: string;
}

export interface MobileDeviceTransferListResponse {
	items: MobileDeviceTransferItem[];
}

export interface MobileDeviceTransferResponse {
	transfer: MobileDeviceTransferItem;
}

/** Human-readable server build label from overview fields. */
export function formatMobileBuildLabel(
	versionName: string | null | undefined,
	versionCode: number | null | undefined
): string | null {
	const name = versionName?.trim() || null;
	const code =
		typeof versionCode === 'number' && versionCode > 0 ? versionCode : null;
	if (name && code != null) return `${name} (${code})`;
	if (name) return name;
	if (code != null) return String(code);
	return null;
}

export async function fetchMobileAppOverview(): Promise<MobileAppOverview> {
	const { data } = await apiClient.get<MobileAppOverview>(
		'/api/v1/mobile-app/overview',
		mobileSessionScopedGetConfig()
	);
	return data;
}

export async function requestMobileApkDownloadTicket(): Promise<MobileAppDownloadTicket> {
	const { data } = await apiClient.post<MobileAppDownloadTicket>(
		'/api/v1/mobile-app/download-ticket'
	);
	return data;
}

export async function fetchMobileTrustedDevices(): Promise<MobileTrustedDeviceListResponse> {
	const { data } = await apiClient.get<MobileTrustedDeviceListResponse>(
		'/api/v1/mobile-devices',
		mobileSessionScopedGetConfig()
	);
	return data;
}

export async function createMobilePairingChallenge(
	prepareGafE2ee: boolean
): Promise<MobilePairingChallengeResponse> {
	const { data } = await apiClient.post<MobilePairingChallengeResponse>(
		'/api/v1/mobile-devices/pairing-challenges',
		{ prepare_gaf_e2ee: prepareGafE2ee }
	);
	return data;
}

export async function revokeMobileTrustedDevice(
	deviceId: string,
	reason?: string
): Promise<void> {
	await apiClient.post(`/api/v1/mobile-devices/${deviceId}/revoke`, {
		reason: reason ?? null,
	});
}

export async function fetchAdminMobileTrustedDevices(
	userId: string
): Promise<MobileTrustedDeviceListResponse> {
	const { data } = await apiClient.get<MobileTrustedDeviceListResponse>(
		`/api/v1/mobile-devices/admin/users/${userId}/devices`
	);
	return data;
}

export async function fetchAdminMobileTrustedDeviceAudit(
	userId: string
): Promise<MobileDeviceAuditEventListResponse> {
	const { data } = await apiClient.get<MobileDeviceAuditEventListResponse>(
		`/api/v1/mobile-devices/admin/users/${userId}/audit`
	);
	return data;
}

export async function fetchAdminMobileDeviceTransfers(
	userId: string,
	statusFilter?: string
): Promise<MobileDeviceTransferListResponse> {
	const { data } = await apiClient.get<MobileDeviceTransferListResponse>(
		'/api/v1/mobile-devices/admin/transfers',
		{
			params: {
				user_id: userId,
				...(statusFilter ? { status_filter: statusFilter } : {}),
			},
		}
	);
	return data;
}

export async function approveAdminMobileDeviceTransfer(
	transferId: string
): Promise<MobileDeviceTransferResponse> {
	const { data } = await apiClient.post<MobileDeviceTransferResponse>(
		`/api/v1/mobile-devices/admin/transfers/${transferId}/approve`
	);
	return data;
}

export async function rejectAdminMobileDeviceTransfer(
	transferId: string,
	reason?: string
): Promise<MobileDeviceTransferResponse> {
	const { data } = await apiClient.post<MobileDeviceTransferResponse>(
		`/api/v1/mobile-devices/admin/transfers/${transferId}/reject`,
		{ reason: reason ?? null }
	);
	return data;
}

export async function downloadMobileApkBlob(): Promise<Blob> {
	const { data } = await apiClient.get<Blob>('/api/v1/mobile-app/download', {
		responseType: 'blob',
		timeout: 0,
	});
	return data;
}

export function triggerApkDownloadByUrl(downloadUrl: string): void {
	const absolute = /^https?:\/\//i.test(downloadUrl)
		? downloadUrl
		: new URL(downloadUrl, window.location.origin).toString();
	const anchor = document.createElement('a');
	anchor.href = absolute;
	anchor.rel = 'noopener';
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
}

export function triggerApkDownload(
	blob: Blob,
	filename = 'Empery-Mobile.apk'
): void {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	anchor.rel = 'noopener';
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}
