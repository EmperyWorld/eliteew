/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Covers the document-editor initial-content sync guard that protects TipTap
 * selection from stale React/store writes while typing.
 *
 * Invariants:
 * - Equivalent initial content must still record the active document key.
 * - Focused mismatches for that same document must be treated as stale.
 *
 * Related:
 * - src/components/UltimateDocEditor/utils/docEditorInitialContentSync.ts
 */

import { describe, expect, it } from 'vitest';

import {
	markDocEditorInitialContentSyncedIfEquivalent,
	markDocEditorInitialContentSynced,
	shouldSuppressStaleEditorInitialContentSync,
} from './docEditorInitialContentSync';

describe('shouldSuppressStaleEditorInitialContentSync', () => {
	it('suppresses stale incoming HTML while focused on same document', () => {
		const lastKey = { current: 'doc-a::file-1' };
		expect(
			shouldSuppressStaleEditorInitialContentSync({
				isEditorFocused: true,
				incomingHtml: '<p>old</p>',
				currentHtml: '<p>old typed</p>',
				documentSyncKey: 'doc-a::file-1',
				lastSyncedDocumentKeyRef: lastKey,
			})
		).toBe(true);
	});

	it('allows sync after document key change', () => {
		const lastKey = { current: 'doc-a::file-1' };
		expect(
			shouldSuppressStaleEditorInitialContentSync({
				isEditorFocused: true,
				incomingHtml: '<p>other doc</p>',
				currentHtml: '<p>local</p>',
				documentSyncKey: 'doc-b::file-2',
				lastSyncedDocumentKeyRef: lastKey,
			})
		).toBe(false);
	});

	it('allows sync when editor is not focused', () => {
		const lastKey = { current: 'doc-a::file-1' };
		expect(
			shouldSuppressStaleEditorInitialContentSync({
				isEditorFocused: false,
				incomingHtml: '<p>remote</p>',
				currentHtml: '<p>local</p>',
				documentSyncKey: 'doc-a::file-1',
				lastSyncedDocumentKeyRef: lastKey,
			})
		).toBe(false);
	});

	it('does not suppress when HTML is equivalent', () => {
		const lastKey = { current: 'doc-a::file-1' };
		expect(
			shouldSuppressStaleEditorInitialContentSync({
				isEditorFocused: true,
				incomingHtml: '<p>Hi</p>',
				currentHtml: '<p>Hi</p>',
				documentSyncKey: 'doc-a::file-1',
				lastSyncedDocumentKeyRef: lastKey,
			})
		).toBe(false);
	});
});

describe('markDocEditorInitialContentSynced', () => {
	it('stores document sync key', () => {
		const lastKey = { current: null as string | null };
		markDocEditorInitialContentSynced(lastKey, 'doc-a::file-1');
		expect(lastKey.current).toBe('doc-a::file-1');
	});
});

describe('markDocEditorInitialContentSyncedIfEquivalent', () => {
	it('marks equivalent initial content so later focused store lag is suppressed', () => {
		const lastKey = { current: null as string | null };

		expect(
			markDocEditorInitialContentSyncedIfEquivalent({
				incomingHtml: '<p>Hello</p>',
				currentHtml: '<p>Hello</p>',
				documentSyncKey: 'doc-a::file-1',
				lastSyncedDocumentKeyRef: lastKey,
			})
		).toBe(true);
		expect(lastKey.current).toBe('doc-a::file-1');

		expect(
			shouldSuppressStaleEditorInitialContentSync({
				isEditorFocused: true,
				incomingHtml: '<p>Hello</p>',
				currentHtml: '<p>Hello typed</p>',
				documentSyncKey: 'doc-a::file-1',
				lastSyncedDocumentKeyRef: lastKey,
			})
		).toBe(true);
	});

	it('does not mark when incoming content is different', () => {
		const lastKey = { current: null as string | null };

		expect(
			markDocEditorInitialContentSyncedIfEquivalent({
				incomingHtml: '<p>Hello</p>',
				currentHtml: '<p>Hello typed</p>',
				documentSyncKey: 'doc-a::file-1',
				lastSyncedDocumentKeyRef: lastKey,
			})
		).toBe(false);
		expect(lastKey.current).toBeNull();
	});
});
