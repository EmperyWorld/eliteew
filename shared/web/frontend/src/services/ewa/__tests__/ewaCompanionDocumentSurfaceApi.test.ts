/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for embedded EWA document surface API coercion helpers.
 *
 * Invariants:
 * - No network calls; tests cover client boundary normalization only.
 *
 * Related:
 * - src/services/ewa/ewaCompanionDocumentSurfaceApi.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Vitest 4: factory `vi.fn()` without `vi.hoisted` can bind a different mock
 * instance than the SUT's imported `api` — use stable hoisted refs (same pattern
 * as ewaCompanionAdminTaskRunsApi.test.ts).
 */
const hoisted = vi.hoisted(() => {
	class MockedApiError extends Error {
		constructor(
			message: string,
			public statusCode?: number,
			public errorCode?: string,
			public details?: unknown
		) {
			super(message);
			this.name = 'APIError';
		}
	}
	return {
		APIError: MockedApiError,
		get: vi.fn(),
		post: vi.fn(),
		put: vi.fn(),
		delete: vi.fn(),
		apiClientPost: vi.fn(),
		apiFetchWithAuth: vi.fn(),
	};
});

vi.mock('@/services/api/client', () => ({
	api: {
		get: hoisted.get,
		post: hoisted.post,
		put: hoisted.put,
		delete: hoisted.delete,
	},
	apiClient: {
		post: hoisted.apiClientPost,
	},
	apiFetchWithAuth: hoisted.apiFetchWithAuth,
	APIError: hoisted.APIError,
}));

import {
	deleteEwaCompanionDocumentServerDraft,
	EwaCompanionDocumentDraftConflictError,
	EwaCompanionDocumentSaveConflictError,
	coerceDocumentPreInsertCheck,
	coerceDocumentStructure,
	coerceSurfaceDocument,
	fetchEwaCompanionDocumentStructure,
	fetchEwaCompanionDocumentServerDraft,
	fetchEwaCompanionSurfaceDocument,
	saveEwaCompanionDocumentServerDraft,
	saveEwaCompanionSurfaceDocument,
	streamEwaCompanionDocumentAiTransform,
} from '../ewaCompanionDocumentSurfaceApi';

const mockedApi = {
	get: hoisted.get,
	post: hoisted.post,
	put: hoisted.put,
	delete: hoisted.delete,
};
const mockedApiClient = { post: hoisted.apiClientPost };
const mockedApiFetchWithAuth = hoisted.apiFetchWithAuth;
const APIError = hoisted.APIError;

describe('ewaCompanionDocumentSurfaceApi coercion', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('normalizes DocEditor document rows for embedded surface', () => {
		expect(
			coerceSurfaceDocument({
				id: 'doc-1',
				title: ' Notes ',
				content: '<h1>Hi</h1>',
				content_markdown: '# Hi\n',
				content_html: '<h1>Hi</h1>',
				plain_text: 'Hi',
				mime_type: 'text/markdown',
				original_filename: 'notes.md',
				source_format: 'markdown',
				parse_warnings: [' markdown_glue_normalized ', null],
				version: 7.8,
				document_access_role: 'collaborator',
				collaboration_can_save: false,
			})
		).toEqual({
			id: 'doc-1',
			title: 'Notes',
			content: '<h1>Hi</h1>',
			contentMarkdown: '# Hi\n',
			contentHtml: '<h1>Hi</h1>',
			plainText: 'Hi',
			mimeType: 'text/markdown',
			originalFilename: 'notes.md',
			sourceFormat: 'markdown',
			parseWarnings: ['markdown_glue_normalized'],
			version: 7,
			canSave: false,
		});
	});

	it('normalizes pre-insert policy response variants', () => {
		expect(
			coerceDocumentPreInsertCheck({
				allowed: true,
				warnings: [' one ', null, 'two'],
				text_hash: 'abc',
				checked_at: '2026-05-27T00:00:00Z',
			})
		).toEqual({
			allowed: true,
			warnings: ['one', 'two'],
			textHash: 'abc',
			checkedAt: '2026-05-27T00:00:00Z',
		});
	});

	it('normalizes backend document structure sections without parsing markdown', () => {
		expect(
			coerceDocumentStructure({
				id: 'doc-1',
				title: 'Plan',
				source_format: 'markdown',
				version: 2,
				total_lines: 12,
				total_chars: 140,
				truncated: true,
				max_sections: 1,
				sections: [
					{
						id: 'sec-1-intro',
						level: 1,
						title: 'Intro',
						slug: 'intro',
						line_start: 1,
						line_end: 8,
						char_start: 0,
						char_end: 88,
						preview: 'Opening',
						word_count: 10,
						children_count: 2,
					},
					{ id: '', title: 'bad', level: 1 },
				],
			})
		).toEqual({
			id: 'doc-1',
			title: 'Plan',
			sourceFormat: 'markdown',
			version: 2,
			totalLines: 12,
			totalChars: 140,
			truncated: true,
			maxSections: 1,
			sections: [
				{
					id: 'sec-1-intro',
					level: 1,
					title: 'Intro',
					slug: 'intro',
					lineStart: 1,
					lineEnd: 8,
					charStart: 0,
					charEnd: 88,
					preview: 'Opening',
					wordCount: 10,
					childrenCount: 2,
				},
			],
		});
	});

	it('fetches backend document structure from unified_content endpoint', async () => {
		mockedApi.get.mockResolvedValueOnce({
			id: 'doc-1',
			title: 'Plan',
			sections: [{ id: 'document', title: 'Plan', level: 1 }],
		});

		const structure = await fetchEwaCompanionDocumentStructure(' doc-1 ');

		expect(mockedApi.get).toHaveBeenCalledWith(
			'/api/v1/content/doc-1/document-structure'
		);
		expect(structure.sections[0]?.id).toBe('document');
	});

	it('defaults blocked when policy response is malformed', () => {
		expect(coerceDocumentPreInsertCheck({ warnings: ['x'] })).toEqual({
			allowed: false,
			warnings: ['x'],
			textHash: null,
			checkedAt: null,
		});
	});

	it('fetches unified_content document-body projection before DocEditor fallback', async () => {
		mockedApi.get.mockResolvedValueOnce({
			id: 'doc-1',
			title: 'Projection',
			content_markdown: '# Projection',
			content_html: '<h1>Projection</h1>',
			plain_text: 'Projection',
			source_format: 'markdown',
			can_save: false,
		});

		const doc = await fetchEwaCompanionSurfaceDocument(' doc-1 ');

		expect(mockedApi.get).toHaveBeenCalledWith(
			'/api/v1/content/doc-1/document-body'
		);
		expect(doc.contentMarkdown).toBe('# Projection');
		expect(doc.canSave).toBe(false);
	});

	it('falls back to DocEditor document fetch when projection is unavailable', async () => {
		mockedApi.get.mockRejectedValueOnce(new Error('projection unavailable'));
		mockedApi.get.mockResolvedValueOnce({
			id: 'doc-1',
			title: 'Fallback',
			content_markdown: '# Fallback',
		});

		const doc = await fetchEwaCompanionSurfaceDocument('doc-1');

		expect(mockedApi.get).toHaveBeenNthCalledWith(
			1,
			'/api/v1/content/doc-1/document-body'
		);
		expect(mockedApi.get).toHaveBeenNthCalledWith(
			2,
			'/api/v1/doc-editor/documents/doc-1'
		);
		expect(doc.title).toBe('Fallback');
	});

	it('saves markdown through unified_content replace-file and reloads projection', async () => {
		mockedApiClient.post.mockResolvedValueOnce({ data: {} });
		mockedApi.get.mockResolvedValueOnce({
			id: 'doc-1',
			title: 'Saved',
			content_markdown: '# Saved',
		});

		const doc = await saveEwaCompanionSurfaceDocument('doc-1', {
			content: '# Saved',
			expectedVersion: 2,
			originalFilename: 'notes.html',
		});

		expect(mockedApiClient.post).toHaveBeenCalledWith(
			'/api/v1/content/doc-1/replace-file',
			expect.any(FormData),
			expect.objectContaining({ timeout: 5 * 60 * 1000 })
		);
		const form = mockedApiClient.post.mock.calls[0]?.[1] as FormData;
		const file = form.get('file') as File;
		expect(file.name).toBe('notes.md');
		expect(doc.contentMarkdown).toBe('# Saved');
	});

	it('falls back to DocEditor save only when replace-file fails', async () => {
		mockedApiClient.post.mockRejectedValueOnce(new Error('not unified'));
		mockedApi.put.mockResolvedValueOnce({
			id: 'doc-1',
			title: 'Fallback Save',
			content_markdown: '# Saved',
		});

		const doc = await saveEwaCompanionSurfaceDocument('doc-1', {
			content: '# Saved',
			originalFilename: 'notes.md',
		});

		expect(mockedApi.put).toHaveBeenCalledWith(
			'/api/v1/doc-editor/documents/doc-1',
			expect.objectContaining({ content_type: 'markdown' })
		);
		expect(doc.title).toBe('Fallback Save');
	});

	it('throws typed save conflict when fallback DocEditor responds with version conflict', async () => {
		mockedApiClient.post.mockRejectedValueOnce(new Error('not unified'));
		mockedApi.put.mockRejectedValueOnce(
			new APIError('conflict', 409, undefined, {
				detail: {
					code: 'document_version_conflict',
					expectedVersion: 2,
					currentVersion: 4,
					serverDocument: {
						id: 'doc-1',
						title: 'Server',
						content_markdown: '# Server',
					},
				},
			})
		);

		await expect(
			saveEwaCompanionSurfaceDocument('doc-1', {
				content: '# Local',
				expectedVersion: 2,
			})
		).rejects.toBeInstanceOf(EwaCompanionDocumentSaveConflictError);
	});

	it('uses DocEditor force_save path when explicit forceSave is requested', async () => {
		mockedApi.put.mockResolvedValueOnce({
			id: 'doc-1',
			title: 'Forced',
			content_markdown: '# Forced',
		});

		const doc = await saveEwaCompanionSurfaceDocument('doc-1', {
			content: '# Forced',
			expectedVersion: 2,
			forceSave: true,
		});

		expect(mockedApiClient.post).not.toHaveBeenCalled();
		expect(mockedApi.put).toHaveBeenCalledWith(
			'/api/v1/doc-editor/documents/doc-1',
			expect.objectContaining({
				content_type: 'markdown',
				expected_version: 2,
				force_save: true,
			})
		);
		expect(doc.title).toBe('Forced');
	});

	it('fetches server draft snapshot for cross-session recovery', async () => {
		mockedApi.get.mockResolvedValueOnce({
			draft: {
				document_id: 'doc-1',
				draft_version: 3,
				base_document_version: 2,
				content: '# Draft',
				source_session_id: 'sess-a',
				updated_by: 'user',
				created_at: '2026-05-28T00:00:00Z',
				updated_at: '2026-05-28T00:01:00Z',
			},
		});

		const draft = await fetchEwaCompanionDocumentServerDraft('doc-1');

		expect(mockedApi.get).toHaveBeenCalledWith(
			'/api/v1/doc-editor/documents/doc-1/draft'
		);
		expect(draft).toEqual({
			documentId: 'doc-1',
			draftVersion: 3,
			baseDocumentVersion: 2,
			content: '# Draft',
			sourceSessionId: 'sess-a',
			updatedBy: 'user',
			createdAt: '2026-05-28T00:00:00Z',
			updatedAt: '2026-05-28T00:01:00Z',
		});
	});

	it('saves server draft with optimistic draft version guard', async () => {
		mockedApi.put.mockResolvedValueOnce({
			status: 'ok',
			draft: {
				document_id: 'doc-1',
				draft_version: 5,
				base_document_version: 4,
				content: '# Next',
				source_session_id: 'sess-b',
				updated_by: 'user',
				updated_at: '2026-05-28T00:02:00Z',
			},
		});

		const draft = await saveEwaCompanionDocumentServerDraft('doc-1', {
			content: '# Next',
			baseDocumentVersion: 4,
			expectedDraftVersion: 4,
			sourceSessionId: 'sess-b',
		});

		expect(mockedApi.put).toHaveBeenCalledWith(
			'/api/v1/doc-editor/documents/doc-1/draft',
			expect.objectContaining({
				content: '# Next',
				base_document_version: 4,
				expected_draft_version: 4,
				source_session_id: 'sess-b',
			})
		);
		expect(draft.draftVersion).toBe(5);
	});

	it('throws typed draft conflict when server draft version diverges', async () => {
		mockedApi.put.mockRejectedValueOnce(
			new APIError('conflict', 409, undefined, {
				detail: {
					code: 'draft_version_conflict',
					expectedDraftVersion: 2,
					currentDraftVersion: 3,
					serverDraft: {
						document_id: 'doc-1',
						draft_version: 3,
						base_document_version: 2,
						content: '# Server Draft',
					},
				},
			})
		);

		await expect(
			saveEwaCompanionDocumentServerDraft('doc-1', {
				content: '# Local Draft',
				baseDocumentVersion: 2,
				expectedDraftVersion: 2,
			})
		).rejects.toBeInstanceOf(EwaCompanionDocumentDraftConflictError);
	});

	it('deletes server draft after successful publish', async () => {
		mockedApi.delete.mockResolvedValueOnce({ status: 'ok', deleted: true });

		const deleted = await deleteEwaCompanionDocumentServerDraft('doc-1');

		expect(mockedApi.delete).toHaveBeenCalledWith(
			'/api/v1/doc-editor/documents/doc-1/draft'
		);
		expect(deleted).toBe(true);
	});

	it('sends companion persona and generation settings with transform request', async () => {
		mockedApiFetchWithAuth.mockResolvedValueOnce(
			new Response('data: {"text":"Hello"}\n\ndata: [DONE]\n\n', {
				status: 200,
				headers: { 'Content-Type': 'text/event-stream' },
			})
		);
		const chunks: string[] = [];

		const result = await streamEwaCompanionDocumentAiTransform(
			{
				prompt: 'Rewrite text',
				context: 'Source',
				actionMode: 'rewrite',
				contextScope: 'selection',
				documentId: 'doc-1',
				generationOptions: {
					model: 'qwen3-30b',
					temperature: 0.42,
					maxTokens: 888,
				},
				companionPersona: {
					seedPersonaId: 'arlika_v2',
					name: 'Arlika',
					characterState: { mood: 'warm' },
					styleParameters: { tone: 'supportive' },
					baseline: { voice: 'gentle' },
				},
				noDialogueOutput: true,
			},
			(chunk) => chunks.push(chunk)
		);

		expect(result).toBe('Hello');
		expect(chunks).toEqual(['Hello']);
		const request = mockedApiFetchWithAuth.mock.calls[0];
		expect(request?.[0]).toBe('/api/v1/doc-editor/ai/complete');
		const options = request?.[1] as { body: string };
		const payload = JSON.parse(options.body);
		expect(payload.temperature).toBe(0.42);
		expect(payload.max_tokens).toBe(888);
		expect(payload.model).toBe('qwen3-30b');
		expect(payload.companion_seed_persona_id).toBe('arlika_v2');
		expect(payload.companion_name).toBe('Arlika');
		expect(payload.companion_character_state).toEqual({ mood: 'warm' });
		expect(payload.companion_style_parameters).toEqual({ tone: 'supportive' });
		expect(payload.companion_baseline).toEqual({ voice: 'gentle' });
		expect(payload.companion_no_dialogue).toBe(true);
	});
});
