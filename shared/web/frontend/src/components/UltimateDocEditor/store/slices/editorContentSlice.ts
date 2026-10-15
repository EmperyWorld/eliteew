/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Обновление контента и selection/cursor в Ultimate Doc Editor store.
 *
 * Invariants:
 * - Typing path: `setContent` updates HTML only; oracle stats via `commitAnalyticalSnapshot`.
 * - dirty только при смене content.
 *
 * Related:
 * - `store/editorStore.ts`, `utils/htmlWordCount.ts`
 */

import { editorHtmlContentEquivalent } from '../../utils/htmlComparableText';
import { countWordsFromHtml } from '../../utils/htmlWordCount';
import type { EditorStore } from '../editorStore';
import type { StateCreator } from 'zustand';

export const createEditorContentSlice: StateCreator<
	EditorStore,
	[],
	[],
	Partial<EditorStore>
> = (set, get) => ({
	setContent: (content: string) => {
		const { currentDocument } = get();
		if (currentDocument) {
			const contentChanged = !editorHtmlContentEquivalent(
				currentDocument.content || '',
				content
			);
			set({
				currentDocument: {
					...currentDocument,
					content,
				},
				...(contentChanged ? { isDirty: true } : {}),
			});
		}
	},

	commitAnalyticalSnapshot: (payload: {
		content: string;
		words: number;
		characters: number;
	}) => {
		const { currentDocument } = get();
		if (!currentDocument) {
			return;
		}
		const contentChanged = !editorHtmlContentEquivalent(
			currentDocument.content || '',
			payload.content
		);
		set({
			currentDocument: {
				...currentDocument,
				content: payload.content,
				word_count: payload.words,
				character_count: payload.characters,
			},
			...(contentChanged ? { isDirty: true } : {}),
		});
	},

	setDocumentStats: (stats: { words: number; characters: number }) => {
		const { currentDocument } = get();
		if (!currentDocument) {
			return;
		}
		set({
			currentDocument: {
				...currentDocument,
				word_count: stats.words,
				character_count: stats.characters,
			},
		});
	},

	appendContent: (content: string) => {
		const { currentDocument } = get();
		if (currentDocument) {
			const newContent = currentDocument.content + content;
			const { words, characters } = countWordsFromHtml(newContent);
			set({
				currentDocument: {
					...currentDocument,
					content: newContent,
					word_count: words,
					character_count: characters,
				},
				isDirty: true,
			});
		}
	},

	replaceSelection: (_content: string) => {
		// This will be handled by the editor component
		set({ isDirty: true });
	},

	// ========================================
	// SELECTION ACTIONS
	// ========================================

	setSelectedText: (text: string) => {
		set({ selectedText: text });
	},

	setCursorPosition: (position: { line: number; column: number }) => {
		set({ cursorPosition: position });
	},
});
