/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed Admin API client for Content Ops hub: meta, diagnostics, quota, processing failures, storage remediation.
 *
 * Invariants:
 * - All routes live under `/api/v1/desktop/admin/content-ops/*`.
 *
 * Related:
 * - `pages/Admin/content/ContentAdminSection.tsx`
 */

import { api } from '../../services/api/client';

const BASE = '/api/v1/desktop/admin/content-ops';

export type ContentAdminTab =
	| 'overview'
	| 'diagnostics'
	| 'quota'
	| 'processing-failures'
	| 'storage-ops';

export interface ContentOpsMetaResponse {
	total_content_rows: number;
	total_storage_bytes: number;
	processing_pending: number;
	processing_failed: number;
	workers_healthy: boolean;
	updated_at: string | null;
}

export interface ContentOpsDiagnosticCheck {
	id: string;
	ok: boolean;
	latency_ms: number | null;
	message: string;
}

export interface ContentOpsDiagnosticsResponse {
	checks: ContentOpsDiagnosticCheck[];
}

export interface ContentOpsQuotaResponse {
	user_id: string;
	used_bytes: number;
	quota_bytes: number | null;
	quota_enforced: boolean;
}

export interface ContentProcessingFailureRow {
	id: string;
	user_id: string | null;
	name: string | null;
	title: string | null;
	content_type: string | null;
	processing_status: string | null;
	processing_error: string | null;
	updated_at: string | null;
}

export interface ContentProcessingFailuresResponse {
	total: number;
	limit: number;
	offset: number;
	items: ContentProcessingFailureRow[];
}

export async function getAdminContentOpsMeta(): Promise<ContentOpsMetaResponse> {
	return api.get<ContentOpsMetaResponse>(`${BASE}/meta`);
}

export async function getAdminContentOpsDiagnostics(): Promise<ContentOpsDiagnosticsResponse> {
	return api.get<ContentOpsDiagnosticsResponse>(`${BASE}/diagnostics`);
}

export interface ContentOpsProbeResultRow {
	target: string;
	ok: boolean;
	latency_ms: number;
	error_code: string | null;
	message: string;
	details?: Record<string, unknown> | null;
}

export interface ContentOpsProbeResponse {
	results: ContentOpsProbeResultRow[];
}

export async function postAdminContentOpsProbe(): Promise<ContentOpsProbeResponse> {
	return api.post<ContentOpsProbeResponse>(`${BASE}/probe`);
}

export async function getAdminContentOpsQuota(
	userId: string
): Promise<ContentOpsQuotaResponse> {
	const row = await api.get<{
		user_id: string;
		storage_used_bytes: number;
		storage_quota_bytes: number;
		storage_remaining_bytes: number;
		email?: string | null;
	}>(`${BASE}/quota/users/${encodeURIComponent(userId)}`);
	return {
		user_id: row.user_id,
		used_bytes: row.storage_used_bytes,
		quota_bytes: row.storage_quota_bytes,
		quota_enforced: row.storage_quota_bytes > 0,
	};
}

export interface ContentUserQuotaRow {
	user_id: string;
	email: string | null;
	storage_used_bytes: number;
	storage_quota_bytes: number;
	storage_remaining_bytes: number;
}

export interface ContentUserQuotaPageResponse {
	total: number;
	limit: number;
	offset: number;
	items: ContentUserQuotaRow[];
}

export async function getAdminContentOpsQuotaUsersPage(args?: {
	limit?: number;
	offset?: number;
}): Promise<ContentUserQuotaPageResponse> {
	const params = new URLSearchParams();
	if (args?.limit != null) params.set('limit', String(args.limit));
	if (args?.offset != null) params.set('offset', String(args.offset));
	const qs = params.toString();
	return api.get<ContentUserQuotaPageResponse>(
		`${BASE}/quota/users${qs ? `?${qs}` : ''}`
	);
}

export async function getAdminContentProcessingFailures(args?: {
	limit?: number;
	offset?: number;
}): Promise<ContentProcessingFailuresResponse> {
	const params = new URLSearchParams();
	if (args?.limit != null) params.set('limit', String(args.limit));
	if (args?.offset != null) params.set('offset', String(args.offset));
	const qs = params.toString();
	return api.get<ContentProcessingFailuresResponse>(
		`${BASE}/processing-failures${qs ? `?${qs}` : ''}`
	);
}

export interface ContentStorageMigrateResponse {
	scanned: number;
	migrated: number;
	skipped: number;
	failed: number;
	dry_run: boolean;
	failed_ids: string[];
}

export interface ContentStorageHardPurgeResponse {
	scanned: number;
	purged: number;
	skipped: number;
	failed: number;
	dry_run: boolean;
	older_than_days: number;
	failed_ids: string[];
}

export interface ContentStorageScanMissingResponse {
	dry_run: boolean;
	scanned: number;
	missing_count: number;
	missing_ids: string[];
	quarantined_ids: string[];
	stat_errors: Array<{ id?: string; error?: string }>;
}

function buildStorageOpsQuery(args?: {
	dryRun?: boolean;
	limit?: number;
	onlyContentId?: string;
	olderThanDays?: number;
}): string {
	const params = new URLSearchParams();
	if (args?.dryRun != null) params.set('dry_run', String(args.dryRun));
	if (args?.limit != null) params.set('limit', String(args.limit));
	if (args?.onlyContentId) params.set('only_content_id', args.onlyContentId);
	if (args?.olderThanDays != null) {
		params.set('older_than_days', String(args.olderThanDays));
	}
	const qs = params.toString();
	return qs ? `?${qs}` : '';
}

export async function postAdminContentOpsScanMissingBlobs(args?: {
	dryRun?: boolean;
	limit?: number;
	onlyContentId?: string;
}): Promise<ContentStorageScanMissingResponse> {
	return api.post<ContentStorageScanMissingResponse>(
		`${BASE}/scan-missing-blobs${buildStorageOpsQuery(args)}`
	);
}

export async function postAdminContentOpsMigratePgBlobs(args?: {
	dryRun?: boolean;
	limit?: number;
	onlyContentId?: string;
}): Promise<ContentStorageMigrateResponse> {
	return api.post<ContentStorageMigrateResponse>(
		`${BASE}/migrate-pg-blobs${buildStorageOpsQuery(args)}`
	);
}

export async function postAdminContentOpsHardPurgeSoftDeleted(args?: {
	dryRun?: boolean;
	limit?: number;
	onlyContentId?: string;
	olderThanDays?: number;
}): Promise<ContentStorageHardPurgeResponse> {
	return api.post<ContentStorageHardPurgeResponse>(
		`${BASE}/hard-purge-soft-deleted${buildStorageOpsQuery(args)}`
	);
}

/** Unified Content index ops (not content-ops hub; not Assistant KB). */
export interface ContentReindexAllResponse {
	status: string;
	message?: string;
	[key: string]: unknown;
}

export interface ContentDuplicatesResponse {
	exact_duplicates?: unknown[];
	potential_duplicates?: unknown[];
	summary?: Record<string, unknown>;
	[key: string]: unknown;
}

export async function postAdminContentReindexAll(): Promise<ContentReindexAllResponse> {
	return api.post<ContentReindexAllResponse>('/content/reindex-all');
}

export async function getAdminContentDuplicates(): Promise<ContentDuplicatesResponse> {
	return api.get<ContentDuplicatesResponse>('/content/duplicates');
}
