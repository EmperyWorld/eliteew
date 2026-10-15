/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for semantic dirty detection in the Ultimate Doc Editor
 * content slice.
 *
 * Invariants:
 * - Equivalent HTML serialization must not flip the document back to dirty.
 * - Real content edits still mark the store dirty.
 *
 * Related:
 * - src/components/UltimateDocEditor/store/slices/editorContentSlice.ts
 * - src/components/UltimateDocEditor/utils/htmlComparableText.ts
 */

import { describe, expect, it } from 'vitest';

import { createEditorStoreHook } from '../editorStore';

describe('editorContentSlice semantic dirty detection', () => {
	it('does not mark dirty for equivalent analytical HTML', () => {
		const store = createEditorStoreHook();
		store.setState({
			currentDocument: {
				id: 'doc-1',
				user_id: 'user-1',
				title: 'Draft',
				content: '<p>Hello<br />world</p>',
				content_type: 'html',
				metadata: {},
				tags: [],
				is_public: false,
				access_level: 'private',
				version_number: 12,
				updated_at: '2026-07-29T00:00:00Z',
				created_at: '2026-07-29T00:00:00Z',
				last_accessed_at: '2026-07-29T00:00:00Z',
				word_count: 2,
				character_count: 11,
			},
			isDirty: false,
		});

		store.getState().commitAnalyticalSnapshot({
			content: '<p>Hello<br>world</p>',
			words: 2,
			characters: 11,
		});

		expect(store.getState().isDirty).toBe(false);
	});

	it('still marks dirty for real content changes', () => {
		const store = createEditorStoreHook();
		store.setState({
			currentDocument: {
				id: 'doc-1',
				user_id: 'user-1',
				title: 'Draft',
				content: '<p>Hello</p>',
				content_type: 'html',
				metadata: {},
				tags: [],
				is_public: false,
				access_level: 'private',
				version_number: 12,
				updated_at: '2026-07-29T00:00:00Z',
				created_at: '2026-07-29T00:00:00Z',
				last_accessed_at: '2026-07-29T00:00:00Z',
				word_count: 1,
				character_count: 5,
			},
			isDirty: false,
		});

		store.getState().commitAnalyticalSnapshot({
			content: '<p>Hello there</p>',
			words: 2,
			characters: 11,
		});

		expect(store.getState().isDirty).toBe(true);
	});
});
