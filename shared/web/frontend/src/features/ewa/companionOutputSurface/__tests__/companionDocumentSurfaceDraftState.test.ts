/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for companion document surface draft local persistence helpers.
 *
 * Invariants:
 * - Draft helpers are pure localStorage wrappers (no network side effects).
 *
 * Related:
 * - ../companionDocumentSurfaceDraftState
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
	clearCompanionDocumentSurfaceDraft,
	companionDocumentDraftScopeId,
	loadCompanionDocumentSurfaceDraft,
	saveCompanionDocumentSurfaceDraft,
} from '../companionDocumentSurfaceDraftState';

describe('companionDocumentSurfaceDraftState', () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	it('builds deterministic scope id for document and title fallback', () => {
		expect(
			companionDocumentDraftScopeId({ documentId: ' doc-1 ', title: 'Notes' })
		).toBe('document:doc-1');
		expect(companionDocumentDraftScopeId({ title: ' Product Plan ' })).toBe(
			'title:product plan'
		);
		expect(companionDocumentDraftScopeId({ title: '   ' })).toBeNull();
	});

	it('saves and loads markdown draft snapshot', () => {
		saveCompanionDocumentSurfaceDraft('document:doc-1', {
			title: 'Notes',
			markdown: '# Draft',
			baseVersion: 5,
		});

		const loaded = loadCompanionDocumentSurfaceDraft('document:doc-1');
		expect(loaded).not.toBeNull();
		expect(loaded?.title).toBe('Notes');
		expect(loaded?.markdown).toBe('# Draft');
		expect(loaded?.baseVersion).toBe(5);
		expect(typeof loaded?.updatedAt).toBe('string');
	});

	it('clears stored draft on explicit clear or empty markdown save', () => {
		saveCompanionDocumentSurfaceDraft('document:doc-1', {
			title: 'Notes',
			markdown: '# Draft',
		});
		clearCompanionDocumentSurfaceDraft('document:doc-1');
		expect(loadCompanionDocumentSurfaceDraft('document:doc-1')).toBeNull();

		saveCompanionDocumentSurfaceDraft('document:doc-2', {
			title: 'Notes',
			markdown: '# Draft',
		});
		saveCompanionDocumentSurfaceDraft('document:doc-2', {
			title: 'Notes',
			markdown: '   ',
		});
		expect(loadCompanionDocumentSurfaceDraft('document:doc-2')).toBeNull();
	});

	it('ignores malformed storage payloads', () => {
		window.localStorage.setItem(
			'eliteew.ewaCompanion.documentSurfaceDraft.v1::document:doc-1',
			JSON.stringify({ title: 'Broken' })
		);
		expect(loadCompanionDocumentSurfaceDraft('document:doc-1')).toBeNull();
	});
});
