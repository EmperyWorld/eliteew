/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Zustand slice for Ultimate Doc Editor store (searchprompts).
 *
 * Invariants:
 * - Actions use helpers from `editorStoreHelpers.ts`; no direct React.
 *
 * Related:
 * - `store/editorStore.ts`
 */

import type { StateCreator } from 'zustand';
import type { EditorStore } from '../editorStore';
import { log } from '../../../../utils/logger';
import {
	EDITOR_API_BASE,
	apiFetch,
	getAIPromptsFromResponse,
	getSearchResultsFromResponse,
	parseAIPrompt,
} from '../editorStoreHelpers';
import type { AIPromptCategory } from '../../types/editor.types';

export const createEditorSearchPromptsSlice =
	(): StateCreator<EditorStore, [], [], Partial<EditorStore>> =>
	(set, get, _api) => ({
		openSearchPanel: () => set({ searchPanelOpen: true }),
		closeSearchPanel: () => set({ searchPanelOpen: false, searchResults: [] }),

		search: async (query: string, searchType: 'fulltext' | 'semantic') => {
			set({ isLoading: true, error: undefined });
			try {
				const response = await apiFetch(
					`${EDITOR_API_BASE}/search?query=${encodeURIComponent(query)}&search_type=${searchType}`
				);
				set({
					searchResults: getSearchResultsFromResponse(response),
					isLoading: false,
				});
			} catch (error: unknown) {
				// ✅ FIX: Graceful degradation для 404 - endpoint может не существовать
				const errorObj = error as { status?: number; message?: string };
				if (errorObj?.status === 404 || errorObj?.message?.includes('404')) {
					log.warn('EditorStore', 'Prompts endpoint not available (404)');
					set({ savedPrompts: [], isLoading: false, error: undefined });
				} else {
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					set({ error: errorMessage, isLoading: false });
				}
			}
		},

		// ========================================
		// PROMPTS ACTIONS
		// ========================================

		openPromptsPanel: () => set({ promptsPanelOpen: true }),
		closePromptsPanel: () => set({ promptsPanelOpen: false }),

		savePrompt: async (
			name: string,
			prompt: string,
			category: AIPromptCategory
		) => {
			set({ isLoading: true, error: undefined });
			try {
				const newPrompt = await apiFetch(`${EDITOR_API_BASE}/prompts`, {
					method: 'POST',
					body: JSON.stringify({ name, prompt, category }),
				});
				const parsedPrompt = parseAIPrompt(newPrompt);
				set(
					(state): Partial<EditorStore> => ({
						savedPrompts: parsedPrompt
							? [...state.savedPrompts, parsedPrompt]
							: state.savedPrompts,
						isLoading: false,
					})
				);
			} catch (error: unknown) {
				// ✅ FIX: Graceful degradation для 404 - endpoint может не существовать
				const errorObj = error as { status?: number; message?: string };
				if (errorObj?.status === 404 || errorObj?.message?.includes('404')) {
					log.warn('EditorStore', 'Prompts endpoint not available (404)');
					set({ savedPrompts: [], isLoading: false, error: undefined });
				} else {
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					set({ error: errorMessage, isLoading: false });
				}
			}
		},

		loadPrompts: async () => {
			set({ isLoading: true, error: undefined });
			try {
				const prompts = await apiFetch(`${EDITOR_API_BASE}/prompts`);
				set({
					savedPrompts: getAIPromptsFromResponse(prompts),
					isLoading: false,
				});
			} catch (error: unknown) {
				// ✅ FIX: Graceful degradation для 404 - endpoint может не существовать
				const errorObj = error as { status?: number; message?: string };
				if (errorObj?.status === 404 || errorObj?.message?.includes('404')) {
					log.warn('EditorStore', 'Prompts endpoint not available (404)');
					set({ savedPrompts: [], isLoading: false, error: undefined });
				} else {
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					set({ error: errorMessage, isLoading: false });
				}
			}
		},

		usePrompt: async (promptId: string) => {
			const { savedPrompts } = get();
			const prompt = savedPrompts.find((p) => p.id === promptId);
			if (prompt) {
				await get().completeText(prompt.prompt);
			}
		},
	});
