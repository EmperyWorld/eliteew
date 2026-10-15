/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin client for the EWA companion embedded document transformer: load/save documents, sync server drafts, fetch backend structure, and stream AI text transforms.
 *
 * Invariants:
 * - Unified Content document bodies use the server projection endpoint; DocEditor endpoints remain compatibility fallback.
 * - AI transform only returns text suggestions. Applying/saving is an explicit user action in the surface.
 * - Pre-insert policy check is run before the surface mutates local markdown with AI output.
 * - Document structure coercion accepts only server-provided sections and never parses Markdown client-side.
 * - Server draft updates use DocEditor optimistic draft-version checks and surface typed conflict errors to UI.
 * - Transform requests may carry companion persona/style metadata and generation tuning, but never include chat transcript arrays.
 *
 * Related:
 * - src/features/ewa/companionOutputSurface/CompanionDocumentEditorMode.tsx
 * - api/routers/doc_editor.py
 */

import {
	APIError,
	api,
	apiClient,
	apiFetchWithAuth,
} from '@/services/api/client';
import { API_PATHS } from '@/services/api/config';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';

import type { components as ContentComponents } from '@/generated/content-openapi';

/** Unified Content pilot — document body / structure for companion surface. */
type UnifiedContentDocumentBodyResponse =
	ContentComponents['schemas']['UnifiedContentDocumentBodyResponse'];
type UnifiedContentDocumentStructureResponse =
	ContentComponents['schemas']['UnifiedContentDocumentStructureResponse'];

/**
 * DocEditor v1 (`API_PATHS.DOC_EDITOR`) has no living OpenAPI pilot (pilot is doc-editor-v2).
 * JSON bags stay Record until v1 is SSOT or surface migrates fully to Unified Content.
 */
type DocEditorV1Json = Record<string, unknown>;

export type EwaCompanionSurfaceDocument = {
	id: string;
	title: string;
	content: string;
	contentMarkdown: string;
	contentHtml: string;
	plainText: string;
	mimeType: string;
	originalFilename: string;
	sourceFormat: 'html' | 'markdown' | 'text' | string;
	parseWarnings: string[];
	version: number;
	canSave: boolean;
};

export type EwaCompanionDocumentSaveConflict = {
	expectedVersion: number;
	currentVersion: number;
	serverDocument: EwaCompanionSurfaceDocument | null;
};

export class EwaCompanionDocumentSaveConflictError extends Error {
	constructor(public readonly conflict: EwaCompanionDocumentSaveConflict) {
		super('document_version_conflict');
		this.name = 'EwaCompanionDocumentSaveConflictError';
	}
}

export type EwaCompanionDocumentServerDraft = {
	documentId: string;
	draftVersion: number;
	baseDocumentVersion: number;
	content: string;
	sourceSessionId: string;
	updatedBy: string;
	createdAt: string | null;
	updatedAt: string | null;
};

export type EwaCompanionDocumentDraftConflict = {
	expectedDraftVersion: number;
	currentDraftVersion: number;
	serverDraft: EwaCompanionDocumentServerDraft | null;
};

export class EwaCompanionDocumentDraftConflictError extends Error {
	constructor(public readonly conflict: EwaCompanionDocumentDraftConflict) {
		super('draft_version_conflict');
		this.name = 'EwaCompanionDocumentDraftConflictError';
	}
}

export type EwaCompanionDocumentAiAction =
	| 'rewrite'
	| 'expand'
	| 'summarize'
	| 'translate'
	| 'free';

export type EwaCompanionDocumentPreInsertCheck = {
	allowed: boolean;
	warnings: string[];
	textHash: string | null;
	checkedAt: string | null;
};

export type EwaCompanionDocumentStructureSection = {
	id: string;
	level: number;
	title: string;
	slug: string;
	lineStart: number;
	lineEnd: number;
	charStart: number;
	charEnd: number;
	preview: string;
	wordCount: number;
	childrenCount: number;
};

export type EwaCompanionDocumentStructure = {
	id: string;
	title: string;
	sourceFormat: string;
	version: number;
	totalLines: number;
	totalChars: number;
	sections: EwaCompanionDocumentStructureSection[];
	truncated: boolean;
	maxSections: number;
};

export type EwaCompanionDocumentTransformGenerationOptions = {
	model?: string | null;
	temperature?: number | null;
	maxTokens?: number | null;
};

export type EwaCompanionDocumentTransformPersona = {
	seedPersonaId?: string | null;
	name?: string | null;
	characterState?: Record<string, unknown> | null;
	styleParameters?: Record<string, unknown> | null;
	baseline?: Record<string, unknown> | null;
};

function asRecord(raw: unknown): Record<string, unknown> {
	return raw && typeof raw === 'object' && !Array.isArray(raw)
		? (raw as Record<string, unknown>)
		: {};
}

function asString(raw: unknown, fallback = ''): string {
	return typeof raw === 'string' ? raw : raw == null ? fallback : String(raw);
}

function asFiniteInt(raw: unknown): number | null {
	if (typeof raw === 'number' && Number.isFinite(raw)) {
		return Math.max(0, Math.trunc(raw));
	}
	if (typeof raw === 'string' && raw.trim()) {
		const parsed = Number.parseInt(raw, 10);
		if (Number.isFinite(parsed)) return Math.max(0, parsed);
	}
	return null;
}

function asArray(raw: unknown): unknown[] {
	return Array.isArray(raw) ? raw : [];
}

function readBoolean(raw: unknown): boolean | null {
	return typeof raw === 'boolean' ? raw : null;
}

function markdownSaveFilename(rawName: string, documentId: string): string {
	const trimmed = rawName.trim();
	const fallback = `${documentId.trim() || 'document'}.md`;
	const source = trimmed || fallback;
	const safe = source.replace(/[\\/:*?"<>|]+/g, '-').trim() || fallback;
	if (/\.(?:md|markdown)$/i.test(safe)) return safe;
	const withoutExt = safe.replace(/\.[^.]{1,16}$/u, '').trim();
	return `${withoutExt || documentId.trim() || 'document'}.md`;
}

export function coerceSurfaceDocument(
	raw: unknown
): EwaCompanionSurfaceDocument {
	const rec = asRecord(raw);
	const warningsRaw = Array.isArray(rec.parse_warnings)
		? rec.parse_warnings
		: Array.isArray(rec.parseWarnings)
			? rec.parseWarnings
			: [];
	const contentHtml = asString(rec.content_html || rec.content);
	const contentMarkdown = asString(rec.content_markdown || rec.contentMarkdown);
	const canSave =
		readBoolean(rec.can_save) ??
		readBoolean(rec.canSave) ??
		(rec.document_access_role === 'collaborator'
			? rec.collaboration_can_save === true
			: true);
	return {
		id: asString(rec.id).trim(),
		title: asString(rec.title, 'Document').trim() || 'Document',
		content: asString(rec.content),
		contentMarkdown,
		contentHtml,
		plainText: asString(rec.plain_text),
		mimeType: asString(rec.mime_type, 'text/markdown'),
		originalFilename: asString(
			rec.original_filename || rec.originalFilename
		).trim(),
		sourceFormat:
			asString(rec.source_format || rec.sourceFormat).trim() || 'unknown',
		parseWarnings: warningsRaw
			.map((item) => asString(item).trim())
			.filter(Boolean),
		version:
			typeof rec.version === 'number' && Number.isFinite(rec.version)
				? Math.max(0, Math.trunc(rec.version))
				: 0,
		canSave,
	};
}

function parseDocumentSaveConflict(
	error: unknown
): EwaCompanionDocumentSaveConflict | null {
	if (!(error instanceof APIError) || error.statusCode !== 409) return null;
	const outer = asRecord(error.details);
	const detail = asRecord(outer.detail);
	const payload = Object.keys(detail).length > 0 ? detail : outer;
	const code = asString(payload.code).trim();
	if (code !== 'document_version_conflict') return null;
	const serverDocumentRaw =
		payload.serverDocument ?? payload.server_document ?? null;
	return {
		expectedVersion:
			asFiniteInt(payload.expectedVersion || payload.expected_version) ?? 0,
		currentVersion:
			asFiniteInt(payload.currentVersion || payload.current_version) ?? 0,
		serverDocument:
			serverDocumentRaw &&
			typeof serverDocumentRaw === 'object' &&
			!Array.isArray(serverDocumentRaw)
				? coerceSurfaceDocument(serverDocumentRaw)
				: null,
	};
}

function coerceServerDraft(
	raw: unknown
): EwaCompanionDocumentServerDraft | null {
	const rec = asRecord(raw);
	const documentId = asString(rec.documentId || rec.document_id).trim();
	if (!documentId) return null;
	return {
		documentId,
		draftVersion: asFiniteInt(rec.draftVersion || rec.draft_version) ?? 0,
		baseDocumentVersion:
			asFiniteInt(rec.baseDocumentVersion || rec.base_document_version) ?? 0,
		content: asString(rec.content),
		sourceSessionId: asString(
			rec.sourceSessionId || rec.source_session_id
		).trim(),
		updatedBy: asString(rec.updatedBy || rec.updated_by).trim(),
		createdAt: asString(rec.createdAt || rec.created_at).trim() || null,
		updatedAt: asString(rec.updatedAt || rec.updated_at).trim() || null,
	};
}

function parseDocumentDraftConflict(
	error: unknown
): EwaCompanionDocumentDraftConflict | null {
	if (!(error instanceof APIError) || error.statusCode !== 409) return null;
	const outer = asRecord(error.details);
	const detail = asRecord(outer.detail);
	const payload = Object.keys(detail).length > 0 ? detail : outer;
	const code = asString(payload.code).trim();
	if (code !== 'draft_version_conflict') return null;
	return {
		expectedDraftVersion:
			asFiniteInt(
				payload.expectedDraftVersion || payload.expected_draft_version
			) ?? 0,
		currentDraftVersion:
			asFiniteInt(
				payload.currentDraftVersion || payload.current_draft_version
			) ?? 0,
		serverDraft: coerceServerDraft(payload.serverDraft || payload.server_draft),
	};
}

export function coerceDocumentPreInsertCheck(
	raw: unknown
): EwaCompanionDocumentPreInsertCheck {
	const rec = asRecord(raw);
	const warningsRaw = Array.isArray(rec.warnings) ? rec.warnings : [];
	return {
		allowed: rec.allowed === true,
		warnings: warningsRaw.map((item) => asString(item).trim()).filter(Boolean),
		textHash: asString(rec.textHash || rec.text_hash).trim() || null,
		checkedAt: asString(rec.checkedAt || rec.checked_at).trim() || null,
	};
}

function coerceDocumentStructureSection(
	raw: unknown
): EwaCompanionDocumentStructureSection | null {
	const rec = asRecord(raw);
	const id = asString(rec.id).trim();
	const title = asString(rec.title).trim();
	const level = asFiniteInt(rec.level) ?? 0;
	if (!id || !title || level < 1 || level > 6) return null;
	const charStart = asFiniteInt(rec.charStart ?? rec.char_start) ?? 0;
	const charEnd = asFiniteInt(rec.charEnd ?? rec.char_end) ?? charStart;
	return {
		id,
		level,
		title,
		slug: asString(rec.slug, id).trim() || id,
		lineStart: asFiniteInt(rec.lineStart ?? rec.line_start) ?? 1,
		lineEnd: asFiniteInt(rec.lineEnd ?? rec.line_end) ?? 1,
		charStart,
		charEnd: Math.max(charStart, charEnd),
		preview: asString(rec.preview),
		wordCount: asFiniteInt(rec.wordCount ?? rec.word_count) ?? 0,
		childrenCount: asFiniteInt(rec.childrenCount ?? rec.children_count) ?? 0,
	};
}

export function coerceDocumentStructure(
	raw: unknown
): EwaCompanionDocumentStructure {
	const rec = asRecord(raw);
	const sections = asArray(rec.sections)
		.map(coerceDocumentStructureSection)
		.filter(
			(section): section is EwaCompanionDocumentStructureSection =>
				section !== null
		);
	return {
		id: asString(rec.id).trim(),
		title: asString(rec.title, 'Document').trim() || 'Document',
		sourceFormat:
			asString(rec.sourceFormat ?? rec.source_format).trim() || 'unknown',
		version: asFiniteInt(rec.version) ?? 0,
		totalLines: asFiniteInt(rec.totalLines ?? rec.total_lines) ?? 0,
		totalChars: asFiniteInt(rec.totalChars ?? rec.total_chars) ?? 0,
		sections,
		truncated: rec.truncated === true,
		maxSections:
			asFiniteInt(rec.maxSections ?? rec.max_sections) ?? sections.length,
	};
}

function unifiedContentDocumentBodyPath(documentId: string): string {
	return `${API_PATHS.CONTENT}/${encodeURIComponent(documentId)}/document-body`;
}

function unifiedContentDocumentStructurePath(documentId: string): string {
	return `${API_PATHS.CONTENT}/${encodeURIComponent(documentId)}/document-structure`;
}

function docEditorDocumentPath(documentId: string): string {
	return `${API_PATHS.DOC_EDITOR}/documents/${encodeURIComponent(documentId)}`;
}

function docEditorDocumentDraftPath(documentId: string): string {
	return `${docEditorDocumentPath(documentId)}/draft`;
}

async function fetchDocEditorSurfaceDocument(
	documentId: string
): Promise<EwaCompanionSurfaceDocument> {
	const payload = await api.get<DocEditorV1Json>(
		docEditorDocumentPath(documentId)
	);
	return coerceSurfaceDocument(payload);
}

async function fetchUnifiedContentSurfaceDocument(
	documentId: string
): Promise<EwaCompanionSurfaceDocument> {
	const payload = await api.get<UnifiedContentDocumentBodyResponse>(
		unifiedContentDocumentBodyPath(documentId)
	);
	return coerceSurfaceDocument(payload);
}

export async function fetchEwaCompanionSurfaceDocument(
	documentId: string
): Promise<EwaCompanionSurfaceDocument> {
	const safeId = documentId.trim();
	if (!safeId) throw new Error('document_id_required');
	try {
		return await fetchUnifiedContentSurfaceDocument(safeId);
	} catch (err) {
		ewaCompanionDegradeDebug(
			'companion_surface_document_unified',
			'unified content document fetch failed; falling back to DocEditor',
			err
		);
		return fetchDocEditorSurfaceDocument(safeId);
	}
}

export async function fetchEwaCompanionDocumentStructure(
	documentId: string
): Promise<EwaCompanionDocumentStructure> {
	const safeId = documentId.trim();
	if (!safeId) throw new Error('document_id_required');
	const payload = await api.get<UnifiedContentDocumentStructureResponse>(
		unifiedContentDocumentStructurePath(safeId)
	);
	return coerceDocumentStructure(payload);
}

export async function saveEwaCompanionSurfaceDocument(
	documentId: string,
	body: {
		content: string;
		expectedVersion?: number | null;
		originalFilename?: string | null;
		title?: string | null;
		forceSave?: boolean;
	}
): Promise<EwaCompanionSurfaceDocument> {
	const safeId = documentId.trim();
	if (!safeId) throw new Error('document_id_required');
	const saveName = markdownSaveFilename(
		body.originalFilename?.trim() || body.title?.trim() || '',
		safeId
	);
	const saveViaDocEditor = async () => {
		try {
			const payload = await api.put<DocEditorV1Json>(
				docEditorDocumentPath(safeId),
				{
					content: body.content,
					content_type: 'markdown',
					...(body.expectedVersion != null
						? { expected_version: body.expectedVersion }
						: {}),
					...(body.forceSave ? { force_save: true } : {}),
				}
			);
			return coerceSurfaceDocument(payload);
		} catch (error) {
			const conflict = parseDocumentSaveConflict(error);
			if (conflict) {
				throw new EwaCompanionDocumentSaveConflictError(conflict);
			}
			throw error;
		}
	};
	if (body.forceSave) {
		return saveViaDocEditor();
	}
	try {
		const file = new File([body.content], saveName, {
			type: 'text/markdown',
		});
		const formData = new FormData();
		formData.append('file', file, file.name);
		await apiClient.post(
			`${API_PATHS.CONTENT}/${encodeURIComponent(safeId)}/replace-file`,
			formData,
			{
				headers: {
					'Content-Type': 'multipart/form-data',
				},
				timeout: 5 * 60 * 1000,
			}
		);
	} catch (replaceError) {
		try {
			return await saveViaDocEditor();
		} catch (fallbackError) {
			if (fallbackError instanceof EwaCompanionDocumentSaveConflictError) {
				throw fallbackError;
			}
			throw replaceError;
		}
	}
	return fetchUnifiedContentSurfaceDocument(safeId);
}

export async function fetchEwaCompanionDocumentServerDraft(
	documentId: string
): Promise<EwaCompanionDocumentServerDraft | null> {
	const safeId = documentId.trim();
	if (!safeId) throw new Error('document_id_required');
	const payload = await api.get<DocEditorV1Json>(
		docEditorDocumentDraftPath(safeId)
	);
	const draft = coerceServerDraft(asRecord(payload).draft);
	return draft;
}

export async function saveEwaCompanionDocumentServerDraft(
	documentId: string,
	body: {
		content: string;
		baseDocumentVersion: number;
		expectedDraftVersion?: number | null;
		sourceSessionId?: string | null;
	}
): Promise<EwaCompanionDocumentServerDraft> {
	const safeId = documentId.trim();
	if (!safeId) throw new Error('document_id_required');
	try {
		const payload = await api.put<DocEditorV1Json>(
			docEditorDocumentDraftPath(safeId),
			{
				content: body.content,
				base_document_version: body.baseDocumentVersion,
				...(body.expectedDraftVersion != null
					? { expected_draft_version: body.expectedDraftVersion }
					: {}),
				...(body.sourceSessionId?.trim()
					? { source_session_id: body.sourceSessionId.trim() }
					: {}),
			}
		);
		const draft = coerceServerDraft(asRecord(payload).draft);
		if (!draft) throw new Error('document_server_draft_invalid_response');
		return draft;
	} catch (error) {
		const conflict = parseDocumentDraftConflict(error);
		if (conflict) {
			throw new EwaCompanionDocumentDraftConflictError(conflict);
		}
		throw error;
	}
}

export async function deleteEwaCompanionDocumentServerDraft(
	documentId: string
): Promise<boolean> {
	const safeId = documentId.trim();
	if (!safeId) throw new Error('document_id_required');
	const payload = await api.delete<DocEditorV1Json>(
		docEditorDocumentDraftPath(safeId)
	);
	return asRecord(payload).deleted === true;
}

export async function checkEwaCompanionDocumentPreInsert(body: {
	text: string;
	contextScope: 'selection' | 'document';
	documentId?: string | null;
}): Promise<EwaCompanionDocumentPreInsertCheck> {
	const text = body.text.trim();
	if (!text) throw new Error('document_ai_empty_candidate');
	const payload = await api.post<DocEditorV1Json>(
		`${API_PATHS.DOC_EDITOR}/ai/pre-insert-check`,
		{
			text,
			context_scope: body.contextScope,
			document_id: body.documentId || null,
		}
	);
	return coerceDocumentPreInsertCheck(payload);
}

export async function streamEwaCompanionDocumentAiTransform(
	body: {
		prompt: string;
		context: string;
		actionMode: EwaCompanionDocumentAiAction;
		contextScope: 'selection' | 'document';
		documentId?: string | null;
		generationOptions?: EwaCompanionDocumentTransformGenerationOptions | null;
		companionPersona?: EwaCompanionDocumentTransformPersona | null;
		noDialogueOutput?: boolean;
	},
	onChunk: (chunk: string) => void,
	signal?: AbortSignal
): Promise<string> {
	const payload: Record<string, unknown> = {
		prompt: body.prompt,
		context: body.context,
		action_mode: body.actionMode,
		context_scope: body.contextScope,
		document_id: body.documentId || undefined,
		stream: true,
		...(body.generationOptions?.model?.trim()
			? { model: body.generationOptions.model.trim() }
			: {}),
		...(typeof body.generationOptions?.temperature === 'number' &&
		Number.isFinite(body.generationOptions.temperature)
			? {
					temperature: Math.max(
						0,
						Math.min(1, body.generationOptions.temperature)
					),
				}
			: {}),
		...(typeof body.generationOptions?.maxTokens === 'number' &&
		Number.isFinite(body.generationOptions.maxTokens)
			? {
					max_tokens: Math.max(
						64,
						Math.trunc(body.generationOptions.maxTokens)
					),
				}
			: {}),
		...(body.companionPersona?.seedPersonaId?.trim()
			? {
					companion_seed_persona_id: body.companionPersona.seedPersonaId.trim(),
				}
			: {}),
		...(body.companionPersona?.name?.trim()
			? { companion_name: body.companionPersona.name.trim() }
			: {}),
		...(body.companionPersona?.characterState
			? { companion_character_state: body.companionPersona.characterState }
			: {}),
		...(body.companionPersona?.styleParameters
			? { companion_style_parameters: body.companionPersona.styleParameters }
			: {}),
		...(body.companionPersona?.baseline
			? { companion_baseline: body.companionPersona.baseline }
			: {}),
		...(body.noDialogueOutput === true ? { companion_no_dialogue: true } : {}),
	};
	const response = await apiFetchWithAuth(
		`${API_PATHS.DOC_EDITOR}/ai/complete`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
			signal,
		}
	);
	if (!response.ok) throw new Error(`document_ai_failed_${response.status}`);
	const reader = response.body?.getReader();
	if (!reader) throw new Error('document_ai_stream_unavailable');
	const decoder = new TextDecoder();
	let buffer = '';
	let accumulated = '';
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() ?? '';
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed.startsWith('data: ')) continue;
			const data = trimmed.slice(6).trim();
			if (!data || data === '[DONE]') continue;
			try {
				const parsed = JSON.parse(data) as Record<string, unknown>;
				if (typeof parsed.error === 'string' && parsed.error.trim()) {
					throw new Error(parsed.error);
				}
				const chunk = asString(parsed.text || parsed.response);
				if (!chunk) continue;
				accumulated += chunk;
				onChunk(chunk);
			} catch (err) {
				if (err instanceof Error) throw err;
			}
		}
	}
	return accumulated;
}
