/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Чистые хелперы и парсеры ответов API для Zustand store редактора документов (волна 7).
 *
 * Invariants:
 * - Без React; без побочных эффектов кроме HTTP в apiFetch/ugsGenerateStream.
 *
 * Related:
 * - store/editorStore.ts, store/slices/*
 */

import { APIError, api } from '../../../services/api/client';
import { runUgsStreamWithRegistry } from '../../../services/api/ugs/runUgsStreamWithRegistry';
import { countWordsFromHtml } from '../utils/htmlWordCount';
import { shortenDataUrlForImageInsert } from '../utils/shortenDataUrlForImageInsert';
import type {
	AIPrompt,
	DocEditorTabSession,
	DocumentVersion,
	EditorState,
	SearchResult,
	UltimateDocument,
} from '../types/editor.types';
import { API_PATHS } from '../../../services/api/config';

export const EDITOR_API_BASE = API_PATHS.DOC_EDITOR;

export function mapDocEditorLoadStatus(
	error: unknown
): 'not_found' | 'forbidden' | 'network' | 'unknown' {
	if (error instanceof APIError) {
		if (error.statusCode === 404) return 'not_found';
		if (error.statusCode === 403) return 'forbidden';
		if (!error.statusCode) return 'network';
	}
	const status = (error as { response?: { status?: number } })?.response
		?.status;
	if (status === 404) return 'not_found';
	if (status === 403) return 'forbidden';
	if (status == null) return 'network';
	return 'unknown';
}

/** Нормализует ответ API в UltimateDocument (content всегда строка, поля по умолчанию). */
export function normalizeDocument(raw: unknown): UltimateDocument {
	if (!raw || typeof raw !== 'object') {
		return defaultDocument('');
	}
	const o = raw as Record<string, unknown>;
	const id = typeof o.id === 'string' ? o.id : String(o.id ?? '');
	const content =
		typeof o.content === 'string'
			? o.content
			: o.content != null
				? String(o.content)
				: '';
	const apiWordCount = typeof o.word_count === 'number' ? o.word_count : 0;
	const apiCharCount =
		typeof o.character_count === 'number' ? o.character_count : 0;
	const fromContent = content
		? countWordsFromHtml(content)
		: { words: 0, characters: 0 };
	const word_count = apiWordCount > 0 ? apiWordCount : fromContent.words;
	const character_count =
		apiCharCount > 0 ? apiCharCount : fromContent.characters;
	return {
		id,
		user_id:
			typeof o.user_id === 'string' ? o.user_id : String(o.user_id ?? ''),
		title:
			typeof o.title === 'string' ? o.title : String(o.title ?? 'Без названия'),
		content,
		content_type:
			o.content_type === 'html' ||
			o.content_type === 'markdown' ||
			o.content_type === 'text' ||
			o.content_type === 'docx'
				? o.content_type
				: 'html',
		metadata:
			o.metadata && typeof o.metadata === 'object' && !Array.isArray(o.metadata)
				? (o.metadata as Record<string, unknown>)
				: {},
		tags: Array.isArray(o.tags)
			? o.tags.filter((t): t is string => typeof t === 'string')
			: [],
		is_public: Boolean(o.is_public),
		access_level:
			o.access_level === 'private' ||
			o.access_level === 'shared' ||
			o.access_level === 'public'
				? o.access_level
				: 'private',
		word_count,
		character_count,
		version: typeof o.version === 'number' ? o.version : undefined,
		version_number:
			typeof o.version_number === 'number'
				? o.version_number
				: typeof o.version === 'number'
					? o.version
					: 1,
		created_at:
			typeof o.created_at === 'string'
				? o.created_at
				: new Date().toISOString(),
		updated_at:
			typeof o.updated_at === 'string'
				? o.updated_at
				: new Date().toISOString(),
		last_accessed_at:
			typeof o.last_accessed_at === 'string'
				? o.last_accessed_at
				: new Date().toISOString(),
		deleted_at: typeof o.deleted_at === 'string' ? o.deleted_at : undefined,
		document_access_role:
			o.document_access_role === 'collaborator' ? 'collaborator' : 'owner',
		collaboration_can_save:
			typeof o.collaboration_can_save === 'boolean'
				? o.collaboration_can_save
				: o.document_access_role !== 'collaborator',
		preview_text:
			typeof o.preview_text === 'string' ? o.preview_text : undefined,
		plain_text: typeof o.plain_text === 'string' ? o.plain_text : undefined,
	};
}

/** Разбор 409 document_version_conflict из тела ответа API (см. http_exception_handler). */
export function extractDocumentVersionConflict(
	err: APIError
): { serverDocument: Record<string, unknown> } | null {
	if (
		err.statusCode !== 409 ||
		err.details == null ||
		typeof err.details !== 'object'
	) {
		return null;
	}
	const d = err.details as Record<string, unknown>;
	const inner = d.error;
	if (!inner || typeof inner !== 'object') {
		return null;
	}
	const e = inner as Record<string, unknown>;
	if (e.code !== 'document_version_conflict') {
		return null;
	}
	const sd = e.serverDocument;
	if (!sd || typeof sd !== 'object') {
		return null;
	}
	return { serverDocument: sd as Record<string, unknown> };
}

export function defaultDocument(id: string): UltimateDocument {
	const now = new Date().toISOString();
	return {
		id,
		user_id: '',
		title: 'Без названия',
		content: '<p></p>',
		content_type: 'html',
		metadata: {},
		tags: [],
		is_public: false,
		access_level: 'private',
		word_count: 0,
		character_count: 0,
		version_number: 1,
		created_at: now,
		updated_at: now,
		last_accessed_at: now,
		document_access_role: 'owner',
		collaboration_can_save: true,
	};
}

export function buildDocTabSession(state: EditorState): DocEditorTabSession {
	return {
		currentDocument: state.currentDocument,
		documentSource: state.documentSource,
		isLoadingDocument: state.isLoadingDocument,
		error: state.error,
		isDirty: state.isDirty,
		isSaving: state.isSaving,
		lastSaved: state.lastSaved?.toISOString(),
		selectedText: state.selectedText,
		cursorPosition: { ...state.cursorPosition },
		aiPanelOpen: state.aiPanelOpen,
		aiStreaming: state.aiStreaming,
		aiStreamingText: state.aiStreamingText,
		imageGenPanelOpen: state.imageGenPanelOpen,
		isGeneratingImage: state.isGeneratingImage,
		generatedImages: [...state.generatedImages],
		collabPanelOpen: state.collabPanelOpen,
		activeCollaborators: [...state.activeCollaborators],
		versionsPanelOpen: state.versionsPanelOpen,
		versions: [...state.versions],
	};
}

export function docTabSessionToStatePatch(
	s: DocEditorTabSession
): Partial<EditorState> {
	return {
		currentDocument: s.currentDocument,
		documentSource: s.documentSource,
		isLoadingDocument: s.isLoadingDocument,
		error: s.error,
		isDirty: s.isDirty,
		isSaving: s.isSaving,
		lastSaved: s.lastSaved ? new Date(s.lastSaved) : undefined,
		selectedText: s.selectedText,
		cursorPosition: s.cursorPosition,
		aiPanelOpen: s.aiPanelOpen,
		aiStreaming: s.aiStreaming,
		aiStreamingText: s.aiStreamingText,
		imageGenPanelOpen: s.imageGenPanelOpen,
		isGeneratingImage: s.isGeneratingImage,
		generatedImages: s.generatedImages,
		collabPanelOpen: s.collabPanelOpen,
		activeCollaborators: s.activeCollaborators,
		versionsPanelOpen: s.versionsPanelOpen,
		versions: s.versions,
	};
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Small wrapper over canonical api-клиент.
 * Preserves graceful 404 handling behaviour for legacy callers.
 */
export async function apiFetch(
	url: string,
	options: RequestInit = {}
): Promise<unknown> {
	const method = (options.method || 'GET').toUpperCase();
	const body = options.body ? JSON.parse(options.body as string) : undefined;

	try {
		switch (method) {
			case 'GET':
				return await api.get(url);
			case 'POST':
				return await api.post(url, body);
			case 'PUT':
				return await api.put(url, body);
			case 'DELETE':
				return await api.delete(url);
			default:
				return await api.post(url, body);
		}
	} catch (err) {
		// ✅ Graceful degradation для 404 - endpoint может не существовать
		if (err instanceof APIError && err.statusCode === 404) {
			const error = new Error('API endpoint not available (404)') as Error & {
				status?: number;
			};
			error.status = 404;
			throw error;
		}
		throw err;
	}
}

const UGS_STREAM_URL = '/api/v1/ugs/generate/stream';

/**
 * UGS generate via SSE stream: keep-alive and progress until result or error.
 * Connection is not closed until the image (or result) is ready.
 */
export async function ugsGenerateStream(
	body: Record<string, unknown>,
	callbacks?: {
		onStarted?: (requestId: string) => void;
		onProgress?: (ev: Record<string, unknown>) => void;
	}
): Promise<Record<string, unknown>> {
	return runUgsStreamWithRegistry(UGS_STREAM_URL, body, {
		callbacks: {
			onStarted: (requestId) => callbacks?.onStarted?.(requestId),
			onProgress: (event) =>
				callbacks?.onProgress?.(event as Record<string, unknown>),
		},
	});
}

const DATA_URI_PREFIX_REGEX = /^data:image\//i;
const BASE64_CHUNK_REGEX = /([A-Za-z0-9+/]{128,}={0,3})/;

export function normalizeMime(format?: string): string {
	if (!format) {
		return 'image/png';
	}
	let trimmed = format.trim().toLowerCase();
	if (!trimmed) {
		return 'image/png';
	}
	if (trimmed.startsWith('image/')) {
		return trimmed;
	}
	if (trimmed.startsWith('.')) {
		trimmed = trimmed.slice(1);
	}
	return `image/${trimmed}`;
}

export function ensureImageDataUri(value: string, formatHint?: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		return trimmed;
	}
	if (DATA_URI_PREFIX_REGEX.test(trimmed)) {
		return trimmed;
	}
	const base64 = trimmed.replace(/\s+/g, '');
	return `data:${normalizeMime(formatHint)};base64,${base64}`;
}

export function normalizeImageUrlForDisplay(
	url: string | undefined
): string | undefined {
	if (url == null || url === '') {
		return undefined;
	}
	return shortenDataUrlForImageInsert(url);
}

export function extractImageUrlFromPayload(
	payload: unknown,
	formatHint?: string
): string | undefined {
	if (payload == null) {
		return undefined;
	}

	if (typeof payload === 'string') {
		const trimmed = payload.trim();
		if (!trimmed) {
			return undefined;
		}
		if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
			return trimmed;
		}
		// Относительные пути API (/api/...) — иначе URL теряется и превью в галерее пустое
		if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
			return trimmed;
		}
		if (DATA_URI_PREFIX_REGEX.test(trimmed)) {
			return trimmed;
		}
		const base64Match = trimmed.match(BASE64_CHUNK_REGEX);
		if (base64Match?.[1]) {
			return ensureImageDataUri(base64Match[1], formatHint);
		}
		return undefined;
	}

	if (Array.isArray(payload)) {
		for (const item of payload) {
			const candidate = extractImageUrlFromPayload(item, formatHint);
			if (candidate) {
				return candidate;
			}
		}
		return undefined;
	}

	if (typeof payload === 'object') {
		const obj = payload as Record<string, unknown>;
		const nextFormat = typeof obj.format === 'string' ? obj.format : formatHint;

		const directKeys = ['image_url', 'url', 'signed_url', 'download_url'];
		for (const key of directKeys) {
			if (typeof obj[key] === 'string') {
				const candidate = extractImageUrlFromPayload(obj[key], nextFormat);
				if (candidate) {
					return candidate;
				}
			}
		}

		const dataKeys = ['data_uri', 'data', 'image_data', 'base64'];
		for (const key of dataKeys) {
			const value = obj[key];
			if (typeof value === 'string' && value.trim()) {
				return ensureImageDataUri(value, nextFormat);
			}
		}

		const nestedKeys = [
			'result',
			'result_preview',
			'output',
			'output_data',
			'payload',
			'content',
			'image',
			'value',
			'body',
		];
		for (const key of nestedKeys) {
			if (key in obj) {
				const candidate = extractImageUrlFromPayload(obj[key], nextFormat);
				if (candidate) {
					return candidate;
				}
			}
		}

		if ('images' in payload) {
			const candidate = extractImageUrlFromPayload(payload.images, nextFormat);
			if (candidate) {
				return candidate;
			}
		}

		if ('storage_reference' in payload) {
			const candidate = extractImageUrlFromPayload(
				payload.storage_reference,
				nextFormat
			);
			if (candidate) {
				return candidate;
			}
		}

		if ('assets' in payload) {
			const candidate = extractImageUrlFromPayload(payload.assets, nextFormat);
			if (candidate) {
				return candidate;
			}
		}
	}

	return undefined;
}

export function sanitizeStatusLabel(status: unknown): string | undefined {
	if (typeof status === 'string') {
		const lines = status.split('\n');
		const primary = lines[0]?.trim();
		return primary || status;
	}
	if (status === undefined || status === null) {
		return undefined;
	}
	return String(status);
}

export function isPlainObject(
	value: unknown
): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** API list response: `{ documents?: ... }` */
interface DocumentsListApiResponse {
	documents?: unknown[];
}

export function getDocumentsArrayFromResponse(response: unknown): unknown[] {
	if (!isPlainObject(response)) {
		return [];
	}
	const docs = (response as DocumentsListApiResponse).documents;
	return Array.isArray(docs) ? docs : [];
}

export function parseDocumentListTotal(response: unknown): number {
	if (!isPlainObject(response)) {
		return 0;
	}
	const t = (response as { total?: unknown }).total;
	return typeof t === 'number' && Number.isFinite(t) ? Math.max(0, t) : 0;
}

/** Narrowed UGS `/status/:jobId` payload (unknown-tolerant). */
interface UgsStatusParsed {
	status: string;
	completed_at?: string;
	started_at?: string;
}

export function parseUgsStatusResult(raw: unknown): UgsStatusParsed {
	if (!isPlainObject(raw)) {
		return { status: '' };
	}
	return {
		status: typeof raw.status === 'string' ? raw.status : '',
		completed_at:
			typeof raw.completed_at === 'string' ? raw.completed_at : undefined,
		started_at: typeof raw.started_at === 'string' ? raw.started_at : undefined,
	};
}

/** Narrowed UGS `/result/:jobId` payload for image URL extraction. */
interface UgsGenerationResultParsed {
	root: unknown;
	result?: unknown;
	result_preview?: unknown;
	output_data?: { image_url?: string };
	metadata?: unknown;
	error?: string;
}

export function parseUgsGenerationResult(
	raw: unknown
): UgsGenerationResultParsed {
	if (!isPlainObject(raw)) {
		return { root: raw };
	}
	const od = raw.output_data;
	const output_data =
		isPlainObject(od) && typeof od.image_url === 'string'
			? { image_url: od.image_url }
			: undefined;
	return {
		root: raw,
		result: raw.result,
		result_preview: raw.result_preview,
		output_data,
		metadata: raw.metadata,
		error: typeof raw.error === 'string' ? raw.error : undefined,
	};
}

export function getNestedResultMessage(result: unknown): string | undefined {
	if (!isPlainObject(result) || typeof result.message !== 'string') {
		return undefined;
	}
	return result.message;
}

interface SearchApiResponse {
	results?: unknown[];
}

export function getSearchResultsFromResponse(
	response: unknown
): SearchResult[] {
	if (!isPlainObject(response)) {
		return [];
	}
	const results = (response as SearchApiResponse).results;
	if (!Array.isArray(results)) {
		return [];
	}
	return results
		.map((item): SearchResult | null => {
			if (!isPlainObject(item)) {
				return null;
			}
			const docRaw = item.document;
			if (!isPlainObject(docRaw)) {
				return null;
			}
			const document = normalizeDocument(docRaw);
			const score = typeof item.score === 'number' ? item.score : 0;
			const highlights = Array.isArray(item.highlights)
				? item.highlights.filter((h): h is string => typeof h === 'string')
				: undefined;
			return { document, score, highlights };
		})
		.filter((r): r is SearchResult => r !== null);
}

interface VersionsListApiResponse {
	versions?: unknown[];
}

export function getVersionsFromResponse(response: unknown): DocumentVersion[] {
	if (!isPlainObject(response)) {
		return [];
	}
	const versions = (response as VersionsListApiResponse).versions;
	if (!Array.isArray(versions)) {
		return [];
	}
	return versions
		.map((raw): DocumentVersion | null => {
			if (!isPlainObject(raw)) {
				return null;
			}
			const id = typeof raw.id === 'string' ? raw.id : String(raw.id ?? '');
			const document_id =
				typeof raw.document_id === 'string'
					? raw.document_id
					: String(raw.document_id ?? '');
			const version_number =
				typeof raw.version_number === 'number' ? raw.version_number : 0;
			const title =
				typeof raw.title === 'string' ? raw.title : String(raw.title ?? '');
			const content =
				typeof raw.content === 'string'
					? raw.content
					: String(raw.content ?? '');
			const content_type =
				typeof raw.content_type === 'string' ? raw.content_type : 'html';
			const metadata =
				isPlainObject(raw.metadata) && !Array.isArray(raw.metadata)
					? (raw.metadata as Record<string, unknown>)
					: {};
			const change_summary =
				typeof raw.change_summary === 'string' ? raw.change_summary : undefined;
			const created_by =
				typeof raw.created_by === 'string'
					? raw.created_by
					: String(raw.created_by ?? '');
			const created_at =
				typeof raw.created_at === 'string'
					? raw.created_at
					: new Date().toISOString();
			const word_count =
				typeof raw.word_count === 'number' ? raw.word_count : 0;
			const character_count =
				typeof raw.character_count === 'number' ? raw.character_count : 0;
			if (!id) {
				return null;
			}
			return {
				id,
				document_id,
				version_number,
				title,
				content,
				content_type,
				metadata,
				change_summary,
				created_by,
				created_at,
				word_count,
				character_count,
			};
		})
		.filter((v): v is DocumentVersion => v !== null);
}

const AIPROMPT_CATEGORIES = new Set<string>([
	'general',
	'analysis',
	'generation',
	'improvement',
	'correction',
	'translation',
	'summarization',
	'creative',
	'technical',
]);

export function parseAIPrompt(raw: unknown): AIPrompt | null {
	if (!isPlainObject(raw)) {
		return null;
	}
	const id = typeof raw.id === 'string' ? raw.id : String(raw.id ?? '');
	if (!id) {
		return null;
	}
	const catRaw = raw.category;
	const category =
		typeof catRaw === 'string' && AIPROMPT_CATEGORIES.has(catRaw)
			? (catRaw as AIPrompt['category'])
			: 'general';
	return {
		id,
		user_id:
			typeof raw.user_id === 'string' ? raw.user_id : String(raw.user_id ?? ''),
		name: typeof raw.name === 'string' ? raw.name : String(raw.name ?? ''),
		prompt:
			typeof raw.prompt === 'string' ? raw.prompt : String(raw.prompt ?? ''),
		category,
		model: typeof raw.model === 'string' ? raw.model : undefined,
		temperature: typeof raw.temperature === 'number' ? raw.temperature : 0.7,
		is_public: Boolean(raw.is_public),
		usage_count: typeof raw.usage_count === 'number' ? raw.usage_count : 0,
		last_used_at:
			typeof raw.last_used_at === 'string' ? raw.last_used_at : undefined,
		created_at:
			typeof raw.created_at === 'string'
				? raw.created_at
				: new Date().toISOString(),
		updated_at:
			typeof raw.updated_at === 'string'
				? raw.updated_at
				: new Date().toISOString(),
	};
}

interface PromptsListApiResponse {
	prompts?: unknown[];
}

export function getAIPromptsFromResponse(response: unknown): AIPrompt[] {
	if (Array.isArray(response)) {
		return response
			.map((p) => parseAIPrompt(p))
			.filter((p): p is AIPrompt => p !== null);
	}
	if (!isPlainObject(response)) {
		return [];
	}
	const prompts = (response as PromptsListApiResponse).prompts;
	if (Array.isArray(prompts)) {
		return prompts
			.map((p) => parseAIPrompt(p))
			.filter((p): p is AIPrompt => p !== null);
	}
	const single = parseAIPrompt(response);
	return single ? [single] : [];
}
