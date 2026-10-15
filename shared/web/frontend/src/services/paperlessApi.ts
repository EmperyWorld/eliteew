/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * HTTP client for shared Paperless-ngx integration (`/api/v1/paperless/*`).
 *
 * Invariants:
 * - Uses shared `apiClient`; no duplicate fetch stack.
 * - Token stays server-side; browser only sees document metadata.
 *
 * Related:
 * - api/routers/paperless_integration.py
 */

import { apiClient } from '@/services/api/client';

const PAPERLESS_BASE = '/api/v1/paperless';

export type PaperlessDocumentItem = {
	id: number;
	title: string;
	created?: string | null;
	modified?: string | null;
	file_type?: string | null;
	original_file_name?: string | null;
	tags?: number[];
};

export type PaperlessDocumentListResponse = {
	items: PaperlessDocumentItem[];
	total: number;
	page: number;
	page_size: number;
};

export type PaperlessHealthResponse = {
	configured: boolean;
	reachable: boolean;
};

export async function fetchPaperlessHealth(): Promise<PaperlessHealthResponse> {
	const { data } = await apiClient.get<PaperlessHealthResponse>(
		`${PAPERLESS_BASE}/health`
	);
	return data;
}

export async function listPaperlessDocuments(params?: {
	query?: string;
	page?: number;
	pageSize?: number;
}): Promise<PaperlessDocumentListResponse> {
	const { data } = await apiClient.get<PaperlessDocumentListResponse>(
		`${PAPERLESS_BASE}/documents`,
		{
			params: {
				query: params?.query?.trim() || undefined,
				page: params?.page ?? 1,
				page_size: params?.pageSize ?? 25,
			},
		}
	);
	return data;
}

export async function importPaperlessToEliteEditor(
	paperlessId: number
): Promise<Record<string, unknown>> {
	const { data } = await apiClient.post<Record<string, unknown>>(
		`${PAPERLESS_BASE}/import/${paperlessId}/elite-editor`
	);
	return data;
}

export async function importPaperlessToDocEditorV2(
	paperlessId: number
): Promise<Record<string, unknown>> {
	const { data } = await apiClient.post<Record<string, unknown>>(
		`${PAPERLESS_BASE}/import/${paperlessId}/doc-editor-v2`
	);
	return data;
}
