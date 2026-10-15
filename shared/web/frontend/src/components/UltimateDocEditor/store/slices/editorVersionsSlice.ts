/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Zustand slice for Ultimate Doc Editor store (versions).
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
	getVersionsFromResponse,
	normalizeDocument,
} from '../editorStoreHelpers';

export const createEditorVersionsSlice =
	(): StateCreator<EditorStore, [], [], Partial<EditorStore>> =>
	(set, get, _api) => ({
		openVersionsPanel: () => set({ versionsPanelOpen: true }),
		closeVersionsPanel: () => set({ versionsPanelOpen: false }),

		loadVersions: async (documentId: string) => {
			set({ isLoading: true, error: undefined });
			try {
				const response = await apiFetch(
					`${EDITOR_API_BASE}/documents/${documentId}/versions`
				);
				// Backend returns {versions: [...], total: N}
				set({
					versions: getVersionsFromResponse(response),
					isLoading: false,
				});
			} catch (error: unknown) {
				// ✅ FIX: Graceful degradation для 404 - endpoint может не существовать
				const errorObj = error as { status?: number; message?: string };
				if (errorObj?.status === 404 || errorObj?.message?.includes('404')) {
					log.warn('EditorStore', 'Versions endpoint not available (404)');
					set({ versions: [], isLoading: false, error: undefined });
				} else {
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					set({ error: errorMessage, isLoading: false });
				}
			}
		},

		restoreVersion: async (versionNumber: number) => {
			const { currentDocument } = get();
			if (!currentDocument) {
				return;
			}

			set({
				isLoading: true,
				isLoadingDocument: true,
				error: undefined,
			});
			try {
				const raw = await apiFetch(
					`${EDITOR_API_BASE}/documents/${currentDocument.id}/restore/${versionNumber}`,
					{ method: 'POST' }
				);
				set({
					currentDocument: normalizeDocument(raw),
					documentSource: 'doc_editor',
					isLoading: false,
					isLoadingDocument: false,
				});
			} catch (error: unknown) {
				const errorObj = error as { status?: number; message?: string };
				if (errorObj?.status === 404 || errorObj?.message?.includes('404')) {
					log.warn('EditorStore', 'Restore version not available (404)');
					set({
						isLoading: false,
						isLoadingDocument: false,
						error: undefined,
					});
				} else {
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					set({
						error: errorMessage,
						isLoading: false,
						isLoadingDocument: false,
					});
				}
			}
		},
	});
