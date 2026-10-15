/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression lock for safe TipTap HTML serialization during teardown races.
 *
 * Invariants:
 * - Destroyed editors and getHTML throws return null, never propagate.
 *
 * Related:
 * - utils/safeEditorGetHtml.ts
 */

import type { Editor } from '@tiptap/react';
import { describe, expect, it, vi } from 'vitest';

import { safeEditorGetHtml } from './safeEditorGetHtml';

describe('safeEditorGetHtml', () => {
	it('returns null when editor is missing', () => {
		expect(safeEditorGetHtml(null)).toBeNull();
		expect(safeEditorGetHtml(undefined)).toBeNull();
	});

	it('returns null when editor is destroyed', () => {
		const editor = {
			isDestroyed: true,
			getHTML: vi.fn(() => '<p>x</p>'),
		} as unknown as Editor;
		expect(safeEditorGetHtml(editor)).toBeNull();
		expect(editor.getHTML).not.toHaveBeenCalled();
	});

	it('returns html on happy path', () => {
		const editor = {
			isDestroyed: false,
			getHTML: vi.fn(() => '<p>hello</p>'),
		} as unknown as Editor;
		expect(safeEditorGetHtml(editor)).toBe('<p>hello</p>');
	});

	it('returns null when getHTML throws (schema/view torn down)', () => {
		const editor = {
			isDestroyed: false,
			getHTML: vi.fn(() => {
				throw new TypeError(
					"Cannot read properties of null (reading 'cached')"
				);
			}),
		} as unknown as Editor;
		expect(safeEditorGetHtml(editor)).toBeNull();
	});
});
