/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Zustand slice for Ultimate Doc Editor store (ai).
 *
 * Invariants:
 * - Actions use helpers from `editorStoreHelpers.ts`; no direct React.
 *
 * Related:
 * - `store/editorStore.ts`
 */

import type { StateCreator } from 'zustand';
import type { EditorStore } from '../editorStore';
import i18n from '../../../../i18n/config';
import { apiFetchWithAuth } from '../../../../services/api/client';
import { log } from '../../../../utils/logger';
import { htmlToPlainForAi } from '../../utils/htmlWordCount';
import { EDITOR_API_BASE, apiFetch } from '../editorStoreHelpers';

export const createEditorAiSlice =
	(): StateCreator<EditorStore, [], [], Partial<EditorStore>> =>
	(set, get, _api) => ({
		openAIPanel: () =>
			set({
				aiPanelOpen: true,
				imageGenPanelOpen: false,
			}),

		openAIPanelWithFileFromList: (doc) => {
			const titleRaw = doc.title?.trim();
			const title = titleRaw
				? titleRaw
				: i18n.t('ultimateDocEditor:header.untitled');
			const plainText = htmlToPlainForAi(
				doc.content || doc.preview_text || doc.plain_text || '',
				8000
			);
			set({
				aiFileManagerContext: {
					documentId: doc.id,
					title,
					plainText,
				},
				aiPanelOpen: true,
				imageGenPanelOpen: false,
			});
		},

		clearAiFileManagerContext: () => set({ aiFileManagerContext: null }),

		setFileManagerListCompact: (value: boolean) => {
			set({ fileManagerListCompact: value });
		},

		closeAIPanel: () =>
			set({
				aiPanelOpen: false,
				aiStreamingText: '',
				aiFileManagerContext: null,
			}),

		completeText: async (prompt: string, context?: string) => {
			set({ aiStreaming: true, aiStreamingText: '', error: undefined });

			try {
				const response = await apiFetchWithAuth(
					`${EDITOR_API_BASE}/ai/complete`,
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							prompt,
							context: context || get().selectedText,
							stream: true,
						}),
					}
				);

				if (!response.ok) {
					throw new Error('AI completion failed');
				}

				const reader = response.body?.getReader();
				const decoder = new TextDecoder();

				if (!reader) {
					throw new Error('No reader available');
				}

				let buffer = '';

				const handleSseLine = (line: string): void => {
					const trimmedLine = line.trim();
					if (!trimmedLine.startsWith('data: ')) {
						return;
					}

					const data = trimmedLine.slice(6).trim();
					if (!data || data === '[DONE]') {
						return;
					}

					try {
						const parsed = JSON.parse(data);
						if (typeof parsed.error === 'string' && parsed.error.trim()) {
							throw new Error(parsed.error);
						}
						const text = parsed.text || '';
						if (!text) {
							return;
						}
						set((state) => ({
							aiStreamingText: state.aiStreamingText + text,
						}));
					} catch (error) {
						if (error instanceof Error) {
							throw error;
						}
						// Ignore malformed partial data; buffered parsing should handle normal chunking.
					}
				};

				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						break;
					}

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split('\n');
					buffer = lines.pop() || '';

					for (const line of lines) {
						handleSseLine(line);
					}
				}

				buffer += decoder.decode();
				if (buffer.trim()) {
					handleSseLine(buffer);
				}

				set({ aiStreaming: false });
			} catch (error: unknown) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				set({ error: errorMessage, aiStreaming: false });
			}
		},

		analyzeDocument: async (analysisType: string) => {
			const { currentDocument } = get();
			if (!currentDocument) {
				return;
			}

			set({ isLoading: true, error: undefined });
			try {
				const _result = await apiFetch(`${EDITOR_API_BASE}/ai/analyze`, {
					method: 'POST',
					body: JSON.stringify({
						document_id: currentDocument.id,
						analysis_type: analysisType,
					}),
				});
				// Handle analysis result (e.g., show in AI panel)
				set({ isLoading: false });
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
	});
