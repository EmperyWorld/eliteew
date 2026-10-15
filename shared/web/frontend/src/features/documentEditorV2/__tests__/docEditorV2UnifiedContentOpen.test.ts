/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for unified Content Manager → Document Editor V2 body hydration.
 *
 * Invariants:
 * - Unified open must download blob content, not rely on empty v2 metadata alone.
 *
 * Related:
 * - src/features/documentEditorV2/docEditorV2UnifiedContentOpen.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	hasSubstantiveDocEditorV2Body,
	loadUnifiedContentForDocEditorV2,
} from '../docEditorV2UnifiedContentOpen';

const { getMock } = vi.hoisted(() => ({
	getMock: vi.fn(),
}));

vi.mock('@/services/api', () => ({
	apiClient: {
		get: getMock,
	},
}));

describe('docEditorV2UnifiedContentOpen', () => {
	beforeEach(() => {
		getMock.mockReset();
	});

	it('loads markdown unified content into editor html', async () => {
		getMock.mockImplementation(async (url: string) => {
			if (url.endsWith('/download')) {
				return {
					data: new Blob(['# Hello\n\nBody'], { type: 'text/markdown' }),
				};
			}
			return {
				data: {
					name: 'notes',
					original_filename: 'notes.md',
					mime_type: 'text/markdown',
					content_type: 'document',
				},
			};
		});

		const loaded = await loadUnifiedContentForDocEditorV2('uc-1', {
			fallbackTitle: 'Fallback',
		});

		expect(loaded.title).toBe('notes');
		expect(loaded.contentHtml).toContain('Hello');
		expect(loaded.plainText).toContain('Hello');
		expect(getMock).toHaveBeenCalledWith(
			'/api/v1/content/uc-1',
			expect.any(Object)
		);
		expect(getMock).toHaveBeenCalledWith(
			'/api/v1/content/uc-1/download',
			expect.objectContaining({ responseType: 'blob' })
		);
	});

	it('detects empty v2 projections', () => {
		expect(
			hasSubstantiveDocEditorV2Body({
				plainText: '',
				contentHtml: '<p></p>',
				contentMarkdown: '',
			})
		).toBe(false);
		expect(
			hasSubstantiveDocEditorV2Body({
				plainText: 'Hello',
				contentHtml: '<p>Hello</p>',
			})
		).toBe(true);
	});
});
