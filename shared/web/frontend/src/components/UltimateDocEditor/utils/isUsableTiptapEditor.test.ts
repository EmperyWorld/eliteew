import type { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import {
	isUsableTiptapEditor,
	safeEditorCan,
	safeEditorCanUndo,
} from './isUsableTiptapEditor';

describe('isUsableTiptapEditor', () => {
	it('returns false for null/undefined', () => {
		expect(isUsableTiptapEditor(null)).toBe(false);
		expect(isUsableTiptapEditor(undefined)).toBe(false);
	});

	it('returns false for destroyed editor', () => {
		const destroyed = { isDestroyed: true } as Editor;
		expect(isUsableTiptapEditor(destroyed)).toBe(false);
	});

	it('returns true for live editor stub', () => {
		const live = { isDestroyed: false } as Editor;
		expect(isUsableTiptapEditor(live)).toBe(true);
	});
});

describe('safeEditorCan', () => {
	it('returns false when editor is destroyed', () => {
		const destroyed = { isDestroyed: true } as Editor;
		expect(safeEditorCanUndo(destroyed)).toBe(false);
		expect(safeEditorCan(destroyed, (can) => can.undo())).toBe(false);
	});
});
