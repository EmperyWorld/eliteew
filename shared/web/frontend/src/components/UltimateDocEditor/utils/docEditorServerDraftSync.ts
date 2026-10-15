/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Server-draft conflict parsing and one-shot recovery for Ultimate Doc Editor.
 *
 * Invariants:
 * - Stale draft PUT after canonical save + DELETE is abandoned (no retry storm).
 * - Genuine draft_version_conflict rebases expectedDraftVersion once and retries.
 * - AbortSignal is forwarded to initial PUT and conflict retry (caller owns cancel).
 *
 * Related:
 * - `api/docEditorDraftsApi.ts`, `hooks/useDocEditorDraftPersistence.ts`
 * - `documentation/product/ewa/EWA-COMPANION-DOC-EDITOR-AND-SHELL-CONTEXT.md` §7
 */

import { APIError } from '@/services/api/client';
import {
	saveServerDraft,
	type DraftConflictErrorPayload,
	type ServerDraftPayload,
} from '../api/docEditorDraftsApi';

function asRecord(value: unknown): Record<string, unknown> {
	return value != null && typeof value === 'object'
		? (value as Record<string, unknown>)
		: {};
}

function asFiniteInt(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return Math.trunc(value);
	}
	if (typeof value === 'string' && value.trim()) {
		const parsed = Number.parseInt(value, 10);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

function coerceServerDraft(raw: unknown): ServerDraftPayload | null {
	const rec = asRecord(raw);
	const documentId = String(rec.documentId ?? rec.document_id ?? '').trim();
	if (!documentId) {
		return null;
	}
	return {
		documentId,
		draftVersion: asFiniteInt(rec.draftVersion ?? rec.draft_version) ?? 0,
		baseDocumentVersion:
			asFiniteInt(rec.baseDocumentVersion ?? rec.base_document_version) ?? 0,
		content: String(rec.content ?? ''),
		sourceSessionId: String(
			rec.sourceSessionId ?? rec.source_session_id ?? ''
		).trim(),
		updatedBy: String(rec.updatedBy ?? rec.updated_by ?? '').trim(),
		createdAt:
			typeof rec.createdAt === 'string'
				? rec.createdAt
				: typeof rec.created_at === 'string'
					? rec.created_at
					: null,
		updatedAt:
			typeof rec.updatedAt === 'string'
				? rec.updatedAt
				: typeof rec.updated_at === 'string'
					? rec.updated_at
					: null,
	};
}

/** Parse FastAPI 409 `draft_version_conflict` from {@link APIError.details}. */
export function extractDraftVersionConflict(
	error: unknown
): DraftConflictErrorPayload | null {
	if (!(error instanceof APIError) || error.statusCode !== 409) {
		return null;
	}
	const outer = asRecord(error.details);
	const detail = asRecord(outer.detail);
	const payload = Object.keys(detail).length > 0 ? detail : outer;
	if (payload.code !== 'draft_version_conflict') {
		return null;
	}
	return {
		code: 'draft_version_conflict',
		expectedDraftVersion:
			asFiniteInt(
				payload.expectedDraftVersion ?? payload.expected_draft_version
			) ?? 0,
		currentDraftVersion:
			asFiniteInt(
				payload.currentDraftVersion ?? payload.current_draft_version
			) ?? 0,
		serverDraft: coerceServerDraft(payload.serverDraft ?? payload.server_draft),
	};
}

export type PersistServerDraftPayload = {
	content: string;
	baseDocumentVersion: number;
	expectedDraftVersion?: number | null;
	sourceSessionId?: string | null;
};

/**
 * PUT server draft with one rebased retry on version conflict.
 * Returns null when the PUT is stale (canonical save cleared draft on server).
 */
export async function persistServerDraftWithConflictRecovery(
	documentId: string,
	payload: PersistServerDraftPayload,
	options?: { signal?: AbortSignal }
): Promise<ServerDraftPayload | null> {
	try {
		return await saveServerDraft(documentId, payload, options);
	} catch (error) {
		const conflict = extractDraftVersionConflict(error);
		if (!conflict) {
			throw error;
		}

		const expected = payload.expectedDraftVersion;
		const current = conflict.currentDraftVersion;

		// Autosave cleared draft while a debounced PUT was in flight (expected ≥1, current 0).
		if (
			expected != null &&
			expected > 0 &&
			current === 0 &&
			conflict.serverDraft == null
		) {
			return null;
		}

		return await saveServerDraft(
			documentId,
			{
				...payload,
				expectedDraftVersion: current,
			},
			options
		);
	}
}
