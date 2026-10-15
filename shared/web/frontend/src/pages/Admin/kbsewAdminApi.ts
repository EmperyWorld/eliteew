/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed Admin API client for KBSEW barrels (proxied via stack0 gateway).
 * HTTP DTOs are OpenAPI bridge aliases from `kbsewOpenApi.ts` (Wave 5 SSOT).
 *
 * Invariants:
 * - All routes live under `/api/v1/kbsew/*`.
 * - Optional fields (ready metrics, revision, job trace_id, retrieval_mode) degrade
 *   gracefully when upstream has not landed them yet.
 * - Force-reindex: POST `/barrels/{id}/reindex` (and per-asset) — not ingest idempotency.
 *
 * Related:
 * - `pages/Admin/kbsew/KbsewAdminSection.tsx`
 * - `pages/Admin/kbsewOpenApi.ts`
 * - `documentation/product/KBSEW.md`
 * - `documentation/api/FRONTEND-BACKEND-HTTP.md`
 */

import { api, APIError } from '../../services/api/client';

import type {
	KbsewBarrel,
	KbsewBarrelCreateIn,
	KbsewBarrelStatus,
	KbsewDriversOut,
	KbsewForceReindexAssetResult,
	KbsewForceReindexBarrelResult,
	KbsewIngestIn,
	KbsewIngestResponse,
	KbsewReadyResponse,
	KbsewRetrievalMode,
	KbsewSearchResponse,
} from './kbsewOpenApi';

export type {
	KbsewBarrel,
	KbsewBarrelCreateIn,
	KbsewBarrelsGetOperation,
	KbsewBarrelsPostOperation,
	KbsewBarrelStatus,
	KbsewDriversOut,
	KbsewForceReindexAssetResult,
	KbsewForceReindexBarrelResult,
	KbsewIngestJob,
	KbsewIngestResponse,
	KbsewReadyGetOperation,
	KbsewReadyResponse,
	KbsewRetrievalMode,
	KbsewSearchResponse,
} from './kbsewOpenApi';

const BASE = '/api/v1/kbsew';

export async function listKbsewBarrels(): Promise<KbsewBarrel[]> {
	const rows = await api.get<KbsewBarrel[] | unknown>(`${BASE}/barrels`);
	return Array.isArray(rows) ? rows : [];
}

export async function createKbsewBarrel(
	body: Pick<KbsewBarrelCreateIn, 'name'> &
		Partial<Omit<KbsewBarrelCreateIn, 'name'>>
): Promise<KbsewBarrel> {
	return api.post<KbsewBarrel>(`${BASE}/barrels`, body);
}

export async function deleteKbsewBarrel(barrelId: string): Promise<void> {
	await api.delete(`${BASE}/barrels/${barrelId}`);
}

export async function setKbsewBarrelEnabled(
	barrelId: string,
	enabled: boolean
): Promise<KbsewBarrel> {
	return api.patch<KbsewBarrel>(
		`${BASE}/barrels/${barrelId}/enabled?enabled=${enabled ? 'true' : 'false'}`
	);
}

export async function ingestKbsewDocument(
	barrelId: string,
	sourceUrl: string,
	driverType?: string
): Promise<KbsewIngestResponse> {
	const body: KbsewIngestIn = {
		source_url: sourceUrl,
		driver_type: driverType,
	};
	return api.post<KbsewIngestResponse>(
		`${BASE}/barrels/${barrelId}/ingest`,
		body
	);
}

export async function uploadKbsewDocument(
	barrelId: string,
	file: File,
	driverType?: string
): Promise<KbsewIngestResponse> {
	return api.upload<KbsewIngestResponse>(
		`${BASE}/barrels/${barrelId}/ingest/upload`,
		file,
		undefined,
		driverType ? { driver_type: driverType } : undefined
	);
}

export async function getKbsewBarrelStatus(
	barrelId: string
): Promise<KbsewBarrelStatus> {
	return api.get<KbsewBarrelStatus>(`${BASE}/barrels/${barrelId}/status`);
}

/** Force-reindex all assets in a barrel (bypasses completed-job ingest idempotency). */
export async function forceReindexKbsewBarrel(
	barrelId: string
): Promise<KbsewForceReindexBarrelResult> {
	return api.post<KbsewForceReindexBarrelResult>(
		`${BASE}/barrels/${barrelId}/reindex`,
		{}
	);
}

export async function forceReindexKbsewAsset(
	barrelId: string,
	assetId: string
): Promise<KbsewForceReindexAssetResult> {
	return api.post<KbsewForceReindexAssetResult>(
		`${BASE}/barrels/${barrelId}/assets/${assetId}/reindex`,
		{}
	);
}

export async function listKbsewDrivers(): Promise<KbsewDriversOut> {
	return api.get<KbsewDriversOut>(`${BASE}/drivers`);
}

/**
 * Probe KBSEW readiness via gateway. Returns `null` on 404 (endpoint not landed yet).
 * Other errors rethrow so the Overview can show a degraded banner.
 */
export async function fetchKbsewReady(): Promise<KbsewReadyResponse | null> {
	try {
		return await api.get<KbsewReadyResponse>(`${BASE}/ready`);
	} catch (err) {
		if (err instanceof APIError && err.statusCode === 404) {
			return null;
		}
		throw err;
	}
}

export type KbsewAdminTab =
	| 'overview'
	| 'barrels'
	| 'agent-access'
	| 'test-search';

export async function kbsewSemanticSearch(
	query: string,
	barrelId: string,
	options?: {
		limit?: number;
		retrievalMode?: KbsewRetrievalMode;
		applyAdminSettings?: boolean;
	}
): Promise<KbsewSearchResponse> {
	const body: Record<string, unknown> = {
		query,
		barrel_id: barrelId,
	};
	if (options?.limit != null) {
		body.limit = options.limit;
	}
	if (options?.retrievalMode) {
		body.retrieval_mode = options.retrievalMode;
	}
	if (options?.applyAdminSettings != null) {
		body.apply_admin_settings = options.applyAdminSettings;
	}
	return api.post<KbsewSearchResponse>(`${BASE}/search`, body);
}

const DESKTOP_AI_CHAT_ADMIN = '/api/v1/desktop/admin/ai-chat';

export async function getDesktopAiChatDefaults(): Promise<
	Record<string, unknown>
> {
	const res = await api.get<{ defaults: Record<string, unknown> }>(
		`${DESKTOP_AI_CHAT_ADMIN}/config`
	);
	return res.defaults ?? {};
}

export async function patchDesktopAiChatDefaults(
	defaults: Record<string, unknown>
): Promise<Record<string, unknown>> {
	const res = await api.patch<{ defaults: Record<string, unknown> }>(
		`${DESKTOP_AI_CHAT_ADMIN}/config`,
		{ defaults }
	);
	return res.defaults ?? defaults;
}
