/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Session-safe local draft persistence for companion embedded document editor.
 *
 * Invariants:
 * - Draft scope is deterministic per document id (or title fallback for ad-hoc payloads).
 * - Invalid storage payloads are ignored silently after degrade debug log.
 *
 * Related:
 * - src/features/ewa/companionOutputSurface/CompanionDocumentEditorMode.tsx
 */

import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';

const DRAFT_PREFIX = 'eliteew.ewaCompanion.documentSurfaceDraft.v1::';
const MAX_SCOPE_LEN = 180;
const MAX_TITLE_LEN = 500;
const MAX_MARKDOWN_LEN = 300_000;

export type CompanionDocumentSurfaceDraftSnapshot = {
	title: string;
	markdown: string;
	updatedAt: string;
	baseVersion: number | null;
};

function safeScopeId(raw: string): string {
	return raw.trim().slice(0, MAX_SCOPE_LEN);
}

function draftStorageKey(scopeId: string): string {
	return `${DRAFT_PREFIX}${safeScopeId(scopeId)}`;
}

function toFiniteInt(raw: unknown): number | null {
	if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
	return Math.max(0, Math.trunc(raw));
}

export function companionDocumentDraftScopeId(input: {
	documentId?: string | null;
	title?: string | null;
}): string | null {
	const documentId = input.documentId?.trim() || '';
	if (documentId) return `document:${documentId}`;
	const title = input.title?.trim() || '';
	if (!title) return null;
	return `title:${title.toLowerCase().slice(0, MAX_SCOPE_LEN - 8)}`;
}

export function loadCompanionDocumentSurfaceDraft(
	scopeId: string
): CompanionDocumentSurfaceDraftSnapshot | null {
	if (typeof window === 'undefined') return null;
	const safeScope = safeScopeId(scopeId);
	if (!safeScope) return null;
	try {
		const raw = window.localStorage.getItem(draftStorageKey(safeScope));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as {
			title?: unknown;
			markdown?: unknown;
			updatedAt?: unknown;
			baseVersion?: unknown;
		};
		if (typeof parsed.markdown !== 'string') return null;
		const title =
			typeof parsed.title === 'string'
				? parsed.title.slice(0, MAX_TITLE_LEN)
				: '';
		const markdown = parsed.markdown.slice(0, MAX_MARKDOWN_LEN);
		const updatedAt =
			typeof parsed.updatedAt === 'string' && parsed.updatedAt.trim()
				? parsed.updatedAt.trim()
				: new Date(0).toISOString();
		return {
			title,
			markdown,
			updatedAt,
			baseVersion: toFiniteInt(parsed.baseVersion),
		};
	} catch (err) {
		ewaCompanionDegradeDebug(
			'document_surface_draft_load',
			'local draft parse/load failed',
			err
		);
		return null;
	}
}

export function saveCompanionDocumentSurfaceDraft(
	scopeId: string,
	snapshot: {
		title: string;
		markdown: string;
		baseVersion?: number | null;
	}
): void {
	if (typeof window === 'undefined') return;
	const safeScope = safeScopeId(scopeId);
	if (!safeScope) return;
	const markdown = snapshot.markdown.slice(0, MAX_MARKDOWN_LEN);
	try {
		if (!markdown.trim()) {
			window.localStorage.removeItem(draftStorageKey(safeScope));
			return;
		}
		window.localStorage.setItem(
			draftStorageKey(safeScope),
			JSON.stringify({
				title: snapshot.title.slice(0, MAX_TITLE_LEN),
				markdown,
				updatedAt: new Date().toISOString(),
				baseVersion: toFiniteInt(snapshot.baseVersion) ?? null,
			})
		);
	} catch (err) {
		ewaCompanionDegradeDebug(
			'document_surface_draft_save',
			'local draft persist failed',
			err
		);
	}
}

export function clearCompanionDocumentSurfaceDraft(scopeId: string): void {
	if (typeof window === 'undefined') return;
	const safeScope = safeScopeId(scopeId);
	if (!safeScope) return;
	try {
		window.localStorage.removeItem(draftStorageKey(safeScope));
	} catch (err) {
		ewaCompanionDegradeDebug(
			'document_surface_draft_clear',
			'local draft remove failed',
			err
		);
	}
}
