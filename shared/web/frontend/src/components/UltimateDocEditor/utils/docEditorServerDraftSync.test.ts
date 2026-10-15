/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for Ultimate Doc Editor server-draft conflict recovery.
 *
 * Related:
 * - `docEditorServerDraftSync.ts`
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { APIError } from '@/services/api/client';

import {
	extractDraftVersionConflict,
	persistServerDraftWithConflictRecovery,
} from './docEditorServerDraftSync';

const hoisted = vi.hoisted(() => ({
	saveServerDraft: vi.fn(),
}));

vi.mock('../api/docEditorDraftsApi', () => ({
	saveServerDraft: hoisted.saveServerDraft,
}));

describe('extractDraftVersionConflict', () => {
	it('parses FastAPI detail envelope', () => {
		const err = new APIError('conflict', 409, undefined, {
			detail: {
				code: 'draft_version_conflict',
				expectedDraftVersion: 1,
				currentDraftVersion: 0,
				serverDraft: null,
			},
		});
		expect(extractDraftVersionConflict(err)).toEqual({
			code: 'draft_version_conflict',
			expectedDraftVersion: 1,
			currentDraftVersion: 0,
			serverDraft: null,
		});
	});

	it('returns null for unrelated 409', () => {
		const err = new APIError('other', 409, undefined, {
			detail: { code: 'document_version_conflict' },
		});
		expect(extractDraftVersionConflict(err)).toBeNull();
	});
});

describe('persistServerDraftWithConflictRecovery', () => {
	beforeEach(() => {
		hoisted.saveServerDraft.mockReset();
	});

	it('abandons stale draft PUT after server draft delete', async () => {
		hoisted.saveServerDraft.mockRejectedValueOnce(
			new APIError('conflict', 409, undefined, {
				detail: {
					code: 'draft_version_conflict',
					expectedDraftVersion: 1,
					currentDraftVersion: 0,
					serverDraft: null,
				},
			})
		);

		const result = await persistServerDraftWithConflictRecovery('doc-1', {
			content: '<p>x</p>',
			baseDocumentVersion: 3,
			expectedDraftVersion: 1,
			sourceSessionId: 'sess',
		});

		expect(result).toBeNull();
		expect(hoisted.saveServerDraft).toHaveBeenCalledTimes(1);
	});

	it('forwards AbortSignal to initial PUT and conflict retry', async () => {
		const ac = new AbortController();
		hoisted.saveServerDraft
			.mockRejectedValueOnce(
				new APIError('conflict', 409, undefined, {
					detail: {
						code: 'draft_version_conflict',
						expectedDraftVersion: 1,
						currentDraftVersion: 2,
						serverDraft: {
							documentId: 'doc-1',
							draftVersion: 2,
							baseDocumentVersion: 3,
							content: '<p>other tab</p>',
							sourceSessionId: 'other',
							updatedBy: 'u2',
							createdAt: null,
							updatedAt: null,
						},
					},
				})
			)
			.mockResolvedValueOnce({
				documentId: 'doc-1',
				draftVersion: 3,
				baseDocumentVersion: 3,
				content: '<p>x</p>',
				sourceSessionId: 'sess',
				updatedBy: 'u1',
				createdAt: null,
				updatedAt: '2026-09-01T00:00:00.000Z',
			});

		await persistServerDraftWithConflictRecovery(
			'doc-1',
			{
				content: '<p>x</p>',
				baseDocumentVersion: 3,
				expectedDraftVersion: 1,
				sourceSessionId: 'sess',
			},
			{ signal: ac.signal }
		);

		expect(hoisted.saveServerDraft.mock.calls[0]?.[2]).toEqual({
			signal: ac.signal,
		});
		expect(hoisted.saveServerDraft.mock.calls[1]?.[2]).toEqual({
			signal: ac.signal,
		});
	});

	it('retries once with rebased draft version on genuine conflict', async () => {
		hoisted.saveServerDraft
			.mockRejectedValueOnce(
				new APIError('conflict', 409, undefined, {
					detail: {
						code: 'draft_version_conflict',
						expectedDraftVersion: 1,
						currentDraftVersion: 2,
						serverDraft: {
							documentId: 'doc-1',
							draftVersion: 2,
							baseDocumentVersion: 3,
							content: '<p>other tab</p>',
							sourceSessionId: 'other',
							updatedBy: 'u2',
							createdAt: null,
							updatedAt: null,
						},
					},
				})
			)
			.mockResolvedValueOnce({
				documentId: 'doc-1',
				draftVersion: 3,
				baseDocumentVersion: 3,
				content: '<p>x</p>',
				sourceSessionId: 'sess',
				updatedBy: 'u1',
				createdAt: null,
				updatedAt: '2026-09-01T00:00:00.000Z',
			});

		const result = await persistServerDraftWithConflictRecovery('doc-1', {
			content: '<p>x</p>',
			baseDocumentVersion: 3,
			expectedDraftVersion: 1,
			sourceSessionId: 'sess',
		});

		expect(result?.draftVersion).toBe(3);
		expect(hoisted.saveServerDraft).toHaveBeenCalledTimes(2);
		expect(hoisted.saveServerDraft.mock.calls[1]?.[1]).toMatchObject({
			expectedDraftVersion: 2,
		});
	});
});
