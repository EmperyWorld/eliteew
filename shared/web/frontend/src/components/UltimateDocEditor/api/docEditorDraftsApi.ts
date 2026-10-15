/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * HTTP client for Ultimate Doc Editor server-side document drafts.
 *
 * Invariants:
 * - Optional AbortSignal cancels in-flight PUT without treating cancel as failure.
 *
 * Related:
 * - `utils/docEditorServerDraftSync.ts`, `hooks/useDocEditorDraftPersistence.ts`
 */

import { API_PATHS } from '../../../services/api/config';
import { api } from '../../../services/api/client';

const BASE = API_PATHS.DOC_EDITOR;

export interface ServerDraftPayload {
	documentId: string;
	draftVersion: number;
	baseDocumentVersion: number;
	content: string;
	sourceSessionId: string;
	updatedBy: string;
	createdAt: string | null;
	updatedAt: string | null;
}

export interface DraftConflictErrorPayload {
	code: 'draft_version_conflict';
	expectedDraftVersion: number;
	currentDraftVersion: number;
	serverDraft: ServerDraftPayload | null;
}

export async function fetchServerDraft(
	documentId: string
): Promise<ServerDraftPayload | null> {
	const res = await api.get<{ draft?: ServerDraftPayload | null }>(
		`${BASE}/documents/${documentId}/draft`
	);
	return res.draft ?? null;
}

export async function saveServerDraft(
	documentId: string,
	payload: {
		content: string;
		baseDocumentVersion: number;
		expectedDraftVersion?: number | null;
		sourceSessionId?: string | null;
	},
	options?: { signal?: AbortSignal }
): Promise<ServerDraftPayload> {
	const res = await api.put<{ status: 'ok'; draft: ServerDraftPayload }>(
		`${BASE}/documents/${documentId}/draft`,
		{
			content: payload.content,
			base_document_version: payload.baseDocumentVersion,
			expected_draft_version: payload.expectedDraftVersion ?? null,
			source_session_id: payload.sourceSessionId ?? null,
		},
		options?.signal ? { signal: options.signal } : undefined
	);
	return res.draft;
}

export async function discardServerDraft(documentId: string): Promise<void> {
	await api.delete(`${BASE}/documents/${documentId}/draft`);
}
