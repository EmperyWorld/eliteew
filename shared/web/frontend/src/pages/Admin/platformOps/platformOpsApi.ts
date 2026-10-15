/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed Admin API client for platform-ops (stack0 line, Podman egress, portal peers, seats/licenses/denylist, Air enroll).
 *
 * Invariants:
 * - Routes under `/api/v1/desktop/admin/platform-ops/*`.
 * - stack0/egress remain read-only; portal-peers / seats / licenses / denylist / auth-bindings / air-enroll may mutate (admin JWT).
 * - `api.get` / `api.post` / `api.patch` / `api.delete` already return the response body — do not destructure `.data` again.
 *
 * Related:
 * - `pages/Admin/platformOps/PlatformOpsAdminSection.tsx`
 * - documentation/platform/docker-re_doc/ADMIN-PLATFORM-OPS.md
 */

import { api } from '../../../services/api/client';

const BASE = '/api/v1/desktop/admin/platform-ops';

export type PlatformOpsAdminTab = 'stack0' | 'egress' | 'portalPeers';

export type PlatformOpsOverall = 'ok' | 'degraded' | 'unavailable';

export interface PlatformOpsCheck {
	id: string;
	status: 'ok' | 'degraded' | 'unavailable' | 'unknown';
	detail: string;
}

export interface PlatformOpsStack0Status {
	schema_version: number;
	probe_scope: string;
	probed_at: string;
	overall: PlatformOpsOverall;
	runtime_line: string;
	runtime_line_env: string | null;
	runtime_line_source: string;
	nfs_export_visible: boolean;
	app_build_id: string | null;
	app_version: string;
	product_edition: string | null;
	install_profile: string | null;
	checks: PlatformOpsCheck[];
	cli_hint: string;
	notes: string[];
}

export interface PlatformOpsEgressContainer {
	name: string;
	mode: string;
	running: boolean;
	ips?: string[];
	external_web?: boolean | string | null;
}

export interface PlatformOpsEgressStatus {
	schema_version: number;
	probe_scope: string;
	probed_at: string;
	overall: PlatformOpsOverall;
	status_path: string | null;
	status_path_candidates: string[];
	updated_at: string | null;
	policy_path: string | null;
	containers: PlatformOpsEgressContainer[];
	mode_counts: Record<string, number>;
	error: string | null;
	cli_hint: string;
	notes: string[];
}

export interface PlatformOpsPortalPeer {
	id: string;
	slug: string;
	wg_public_key: string;
	assigned_ip: string;
	status: string;
	label: string | null;
	license_id: string | null;
	edge_sync_status: string;
	edge_synced_at: string | null;
	edge_sync_error: string | null;
	created_at: string;
}

export interface PlatformOpsPortalPeerCreateResult {
	peer: PlatformOpsPortalPeer;
	private_key: string;
	client_conf: string;
	edge_sync_enqueued: boolean;
}

export interface PlatformOpsPortalPeerSyncResult {
	ok: boolean;
	configured: boolean;
	skipped: boolean;
	message?: string | null;
	active_peer_count?: number;
	added_or_updated?: number;
	removed?: number;
}

export async function getPlatformOpsStack0Status(): Promise<PlatformOpsStack0Status> {
	return api.get<PlatformOpsStack0Status>(`${BASE}/stack0-status`);
}

export async function getPlatformOpsEgressStatus(): Promise<PlatformOpsEgressStatus> {
	return api.get<PlatformOpsEgressStatus>(`${BASE}/egress-status`);
}

export async function listPlatformOpsPortalPeers(): Promise<
	PlatformOpsPortalPeer[]
> {
	const body = await api.get<{ peers: PlatformOpsPortalPeer[] }>(
		`${BASE}/portal-peers`
	);
	return body.peers ?? [];
}

export async function createPlatformOpsPortalPeer(input: {
	slug: string;
	label?: string | null;
	license_id?: string | null;
}): Promise<PlatformOpsPortalPeerCreateResult> {
	return api.post<PlatformOpsPortalPeerCreateResult>(`${BASE}/portal-peers`, {
		slug: input.slug,
		label: input.label ?? null,
		license_id: input.license_id ?? null,
	});
}

export async function revokePlatformOpsPortalPeer(
	peerId: string,
	reason?: string | null
): Promise<PlatformOpsPortalPeer> {
	return api.post<PlatformOpsPortalPeer>(
		`${BASE}/portal-peers/${encodeURIComponent(peerId)}/revoke`,
		{ reason: reason ?? null }
	);
}

export async function syncPlatformOpsPortalPeers(): Promise<PlatformOpsPortalPeerSyncResult> {
	return api.post<PlatformOpsPortalPeerSyncResult>(
		`${BASE}/portal-peers/sync`,
		{}
	);
}

export type PlatformOpsSeatMode = 'offline' | 'cloud' | 'both';

export interface PlatformOpsSeatIssueResult {
	filename: string;
	package: Record<string, unknown>;
}

export interface PlatformOpsLicenseCapabilities {
	license_id: string;
	status: string;
	edition: string;
	profile_id: string | null;
	apps: unknown[];
	expires_at: string | null;
	label: string | null;
	allow_offline: boolean;
	allow_online: boolean;
	/** Additive FoFline entitlement (default deny). Independent of offline/cloud mode. */
	allow_fofline: boolean;
	allowed_email: string | null;
	bound_keycloak_sub: string | null;
	email_bound_at: string | null;
	mode: PlatformOpsSeatMode | string;
}

export type PlatformOpsDeviceRequest = {
	kind: string;
	request_id: string;
	product_id: string;
	app_identifier: string;
	device_signing_pubkey: string;
	capsule_recipient_pubkey: string;
	recipient_key_id: string;
	machine_fingerprint_hash: string;
	created_at: string;
	nonce: string;
	signature: string;
};

export async function issuePlatformOpsSeat(input: {
	mode: PlatformOpsSeatMode;
	label?: string | null;
	slug?: string | null;
	allowed_email?: string | null;
	allow_fofline?: boolean;
	device_request: PlatformOpsDeviceRequest;
}): Promise<PlatformOpsSeatIssueResult> {
	return api.post<PlatformOpsSeatIssueResult>(`${BASE}/seats/issue`, {
		mode: input.mode,
		label: input.label ?? null,
		slug: input.slug ?? null,
		allowed_email: input.allowed_email ?? null,
		allow_fofline: Boolean(input.allow_fofline),
		device_request: input.device_request,
	});
}

export async function getPlatformOpsLicense(
	licenseId: string
): Promise<PlatformOpsLicenseCapabilities> {
	return api.get<PlatformOpsLicenseCapabilities>(
		`${BASE}/licenses/${encodeURIComponent(licenseId)}`
	);
}

export async function patchPlatformOpsLicense(
	licenseId: string,
	body: {
		allow_offline?: boolean | null;
		allow_online?: boolean | null;
		allow_fofline?: boolean | null;
		allowed_email?: string | null;
		clear_allowed_email?: boolean;
		clear_account_bind?: boolean;
		label?: string | null;
		expires_at?: string | null;
		clear_expires?: boolean;
		apps?: unknown[] | null;
	}
): Promise<PlatformOpsLicenseCapabilities> {
	return api.patch<PlatformOpsLicenseCapabilities>(
		`${BASE}/licenses/${encodeURIComponent(licenseId)}`,
		body
	);
}

export interface PlatformOpsLicenseInventoryItem {
	license_id: string;
	status: string;
	edition: string;
	profile_id: string | null;
	label: string | null;
	allow_offline: boolean;
	allow_online: boolean;
	allow_fofline: boolean;
	allowed_email: string | null;
	bound_keycloak_sub: string | null;
	expires_at: string | null;
	created_at: string;
	revoked_at: string | null;
	device_count_active: number;
	mode: PlatformOpsSeatMode | string;
}

export interface PlatformOpsLicenseListResult {
	licenses: PlatformOpsLicenseInventoryItem[];
	total: number;
	limit: number;
	offset: number;
}

export interface PlatformOpsLicenseDevice {
	device_id: string;
	license_id: string;
	status: string;
	machine_fingerprint: string;
	device_pubkey: string;
	last_seen_at: string | null;
	created_at: string;
	revoked_at: string | null;
}

export async function listPlatformOpsLicenses(params?: {
	status?: string | null;
	mode?: string | null;
	q?: string | null;
	limit?: number;
	offset?: number;
}): Promise<PlatformOpsLicenseListResult> {
	const qs = new URLSearchParams();
	if (params?.status) qs.set('status', params.status);
	if (params?.mode) qs.set('mode', params.mode);
	if (params?.q) qs.set('q', params.q);
	if (params?.limit != null) qs.set('limit', String(params.limit));
	if (params?.offset != null) qs.set('offset', String(params.offset));
	const suffix = qs.toString() ? `?${qs.toString()}` : '';
	return api.get<PlatformOpsLicenseListResult>(`${BASE}/licenses${suffix}`);
}

export async function revokePlatformOpsLicense(
	licenseId: string,
	reason?: string | null
): Promise<{ ok: boolean; status: string }> {
	return api.post<{ ok: boolean; status: string }>(
		`${BASE}/licenses/${encodeURIComponent(licenseId)}/revoke`,
		{ reason: reason ?? null }
	);
}

export async function listPlatformOpsLicenseDevices(
	licenseId: string
): Promise<PlatformOpsLicenseDevice[]> {
	const body = await api.get<{ devices: PlatformOpsLicenseDevice[] }>(
		`${BASE}/licenses/${encodeURIComponent(licenseId)}/devices`
	);
	return body.devices ?? [];
}

export async function revokePlatformOpsLicenseDevice(
	licenseId: string,
	deviceId: string,
	reason?: string | null
): Promise<{ ok: boolean; status: string }> {
	return api.post<{ ok: boolean; status: string }>(
		`${BASE}/licenses/${encodeURIComponent(licenseId)}/devices/${encodeURIComponent(deviceId)}/revoke`,
		{ reason: reason ?? null }
	);
}

export interface PlatformOpsSoftRevokeEntry {
	license_id: string;
	reason: string | null;
	created_at: string;
	created_by: string | null;
	license_label: string | null;
	license_status: string | null;
}

export interface PlatformOpsDenylistStatus {
	published_at: string | null;
	note: string | null;
	revoked_count: number;
	payload_hash: string | null;
	out_path: string | null;
	pending_count: number;
	updates_out_configured: boolean;
	signing_key_configured: boolean;
	entries: PlatformOpsSoftRevokeEntry[];
}

export interface PlatformOpsDenylistPublishResult {
	published_at: string;
	revoked_count: number;
	payload_hash: string;
	out_path: string;
	note: string | null;
}

export async function getPlatformOpsDenylistStatus(): Promise<PlatformOpsDenylistStatus> {
	return api.get<PlatformOpsDenylistStatus>(`${BASE}/denylist`);
}

export async function addPlatformOpsDenylistEntry(input: {
	license_id: string;
	reason?: string | null;
}): Promise<PlatformOpsSoftRevokeEntry> {
	return api.post<PlatformOpsSoftRevokeEntry>(`${BASE}/denylist/entries`, {
		license_id: input.license_id,
		reason: input.reason ?? null,
	});
}

export async function removePlatformOpsDenylistEntry(
	licenseId: string
): Promise<{ ok: boolean; status: string }> {
	return api.delete<{ ok: boolean; status: string }>(
		`${BASE}/denylist/entries/${encodeURIComponent(licenseId)}`
	);
}

export async function publishPlatformOpsDenylist(
	note?: string | null
): Promise<PlatformOpsDenylistPublishResult> {
	return api.post<PlatformOpsDenylistPublishResult>(
		`${BASE}/denylist/publish`,
		{
			note: note ?? null,
		}
	);
}

export interface PlatformOpsFleetMigrationSummary {
	schema_version: number;
	totals: {
		migration_rows: number;
		by_status: Record<string, number>;
	};
	by_status: Record<string, number>;
	presence_versions: Array<{ app_version: string; count: number }>;
	enrollment: {
		by_status: Record<string, number>;
		issued: number;
		activated: number;
		pending_activation: number;
	};
	licenses_with_multi_active_peers: Array<{
		license_id: string;
		active_peers: number;
	}>;
	licenses_activated_migration_pending?: Array<{
		license_id: string;
		active_peers: number;
	}>;
}

export async function getPlatformOpsFleetMigrationSummary(): Promise<PlatformOpsFleetMigrationSummary> {
	return api.get<PlatformOpsFleetMigrationSummary>(`${BASE}/fleet-migration`);
}

export type PlatformOpsAuthRecoveryAction =
	| 'end_sessions'
	| 'quarantine_device'
	| 'restore_login'
	| 'allow_rebind'
	| 'clear_kc_login_failures';

export interface PlatformOpsAuthRiskEvent {
	kind: string;
	created_at: string | null;
	corroborated: boolean;
	resulting_state: string | null;
	tickets_revoked: number;
}

export interface PlatformOpsAuthBinding {
	binding_id: string;
	license_id: string;
	device_id: string | null;
	client_id: string;
	channel: string;
	state: string;
	authz_epoch: number;
	keycloak_sub: string | null;
	rebind_allowed_until: string | null;
	last_risk_at: string | null;
	updated_at: string;
	events: PlatformOpsAuthRiskEvent[];
}

export interface PlatformOpsAuthBindingActionResult {
	ok: boolean;
	action: string;
	binding_id: string;
	state: string;
	authz_epoch: number;
	replayed: boolean;
	keycloak_touched: boolean;
	license_status_unchanged: boolean;
}

export async function listPlatformOpsAuthBindings(
	licenseId: string
): Promise<PlatformOpsAuthBinding[]> {
	const body = await api.get<{ bindings: PlatformOpsAuthBinding[] }>(
		`${BASE}/licenses/${encodeURIComponent(licenseId)}/auth-bindings`
	);
	return body.bindings;
}

export async function applyPlatformOpsAuthBindingAction(
	bindingId: string,
	input: {
		action: PlatformOpsAuthRecoveryAction;
		reason: string;
		idempotency_key: string;
		confirm: boolean;
	}
): Promise<PlatformOpsAuthBindingActionResult> {
	return api.post<PlatformOpsAuthBindingActionResult>(
		`${BASE}/auth-bindings/${encodeURIComponent(bindingId)}/actions`,
		input
	);
}

/** Wave 6: atomic binding fleet inventory (counts only). */
export interface PlatformOpsAtomicBindingFleetInventory {
	active_licenses: number;
	active_allow_online: number;
	active_allow_fofline: number;
	active_with_bound_sub: number;
	active_devices: number;
	devices_with_pubkey: number;
	identity_bindings: number;
	identity_bindings_active: number;
	identity_bindings_restricted: number;
	identity_bindings_pending_pop: number;
	slots_needing_create: number;
	slots_already_migrated: number;
	slots_conflict: number;
	slots_skip_no_bound_sub: number;
	slots_skip_channel_disabled: number;
}

export interface PlatformOpsAtomicBindingFleetMigrateResult {
	dry_run: boolean;
	created: number;
	already_migrated: number;
	conflict: number;
	skip_no_bound_sub: number;
	skip_channel_disabled: number;
	kc_attrs_synced: number;
	kc_attrs_failed: number;
	license_status_unchanged: boolean;
}

export async function getPlatformOpsAtomicBindingFleetInventory(): Promise<PlatformOpsAtomicBindingFleetInventory> {
	return api.get<PlatformOpsAtomicBindingFleetInventory>(
		`${BASE}/atomic-binding-fleet`
	);
}

export async function migratePlatformOpsAtomicBindingFleet(input: {
	dry_run: boolean;
	confirm: boolean;
}): Promise<PlatformOpsAtomicBindingFleetMigrateResult> {
	return api.post<PlatformOpsAtomicBindingFleetMigrateResult>(
		`${BASE}/atomic-binding-fleet/migrate`,
		input
	);
}

export type PlatformOpsAirEnrollMode = 'offline' | 'cloud' | 'both';

export interface PlatformOpsAirEnrollEvent {
	sequence: number;
	event: string;
	lifecycle: string;
	cleanup_state: string;
	reason: string | null;
	detail: Record<string, unknown>;
	created_at: string;
}

export interface PlatformOpsAirEnrollSession {
	id: string;
	mode: PlatformOpsAirEnrollMode;
	label: string | null;
	slug: string | null;
	allowed_email: string | null;
	allow_fofline: boolean;
	seat_expires_at: string | null;
	created_by: string;
	port: number;
	lifecycle: string;
	cleanup_state: string;
	attempt_count: number;
	license_id: string | null;
	request_id: string | null;
	ecap_sha256: string | null;
	ecap_size: number | null;
	reissue_of: string | null;
	delivery_generation: number;
	provision_expires_at: string;
	code_expires_at: string | null;
	ready_at: string | null;
	revealed_at: string | null;
	claimed_at: string | null;
	sealed_at: string | null;
	activation_acked_at: string | null;
	terminal_at: string | null;
	local_closed_at: string | null;
	sg_closed_at: string | null;
	last_error_code: string | null;
	created_at: string;
	updated_at: string;
	events: PlatformOpsAirEnrollEvent[];
}

export interface PlatformOpsAirEnrollSessionList {
	sessions: PlatformOpsAirEnrollSession[];
	total: number;
	limit: number;
	offset: number;
}

export interface PlatformOpsAirEnrollRevealResult {
	session: PlatformOpsAirEnrollSession;
	access_code: string;
}

export async function createPlatformOpsAirEnrollSession(input: {
	idempotency_key: string;
	mode: PlatformOpsAirEnrollMode;
	label?: string | null;
	slug?: string | null;
	allowed_email?: string | null;
	expires_at?: string | null;
	allow_fofline?: boolean;
}): Promise<PlatformOpsAirEnrollSession> {
	return api.post<PlatformOpsAirEnrollSession>(`${BASE}/air-enroll/sessions`, {
		idempotency_key: input.idempotency_key,
		mode: input.mode,
		label: input.label ?? null,
		slug: input.slug ?? null,
		allowed_email: input.allowed_email ?? null,
		expires_at: input.expires_at ?? null,
		allow_fofline: Boolean(input.allow_fofline),
	});
}

export async function listPlatformOpsAirEnrollSessions(input?: {
	limit?: number;
	offset?: number;
}): Promise<PlatformOpsAirEnrollSessionList> {
	const limit = input?.limit ?? 50;
	const offset = input?.offset ?? 0;
	return api.get<PlatformOpsAirEnrollSessionList>(
		`${BASE}/air-enroll/sessions?limit=${limit}&offset=${offset}`
	);
}

export async function getPlatformOpsAirEnrollSession(
	sessionId: string
): Promise<PlatformOpsAirEnrollSession> {
	return api.get<PlatformOpsAirEnrollSession>(
		`${BASE}/air-enroll/sessions/${encodeURIComponent(sessionId)}`
	);
}

export async function revealPlatformOpsAirEnrollCode(
	sessionId: string
): Promise<PlatformOpsAirEnrollRevealResult> {
	return api.post<PlatformOpsAirEnrollRevealResult>(
		`${BASE}/air-enroll/sessions/${encodeURIComponent(sessionId)}/reveal`,
		{}
	);
}

export async function cancelPlatformOpsAirEnrollSession(
	sessionId: string
): Promise<PlatformOpsAirEnrollSession> {
	return api.post<PlatformOpsAirEnrollSession>(
		`${BASE}/air-enroll/sessions/${encodeURIComponent(sessionId)}/cancel`,
		{}
	);
}

export async function reissuePlatformOpsAirEnrollSession(input: {
	sessionId: string;
	idempotency_key: string;
}): Promise<PlatformOpsAirEnrollSession> {
	return api.post<PlatformOpsAirEnrollSession>(
		`${BASE}/air-enroll/sessions/${encodeURIComponent(input.sessionId)}/reissue`,
		{ idempotency_key: input.idempotency_key }
	);
}
