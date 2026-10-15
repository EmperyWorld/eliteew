/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Корневой Zustand store Ultimate Doc Editor: initial state, compose slices, persist и toast на error.
 *
 * Invariants:
 * - Действия доменов — в `store/slices/*` и `editorStoreHelpers.ts`; здесь только сборка и подписки.
 *
 * Related:
 * - `store/editorStoreContext.tsx`, `store/editorStoreSelectors.ts`
 */

import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { notify } from '@/notifications';
import i18n from '../../../i18n/config';
import type {
	EditorActions,
	EditorState,
	UltimateDocument,
} from '../types/editor.types';
import { createEditorAiSlice } from './slices/editorAiSlice';
import { createEditorCollabSlice } from './slices/editorCollabSlice';
import { createEditorContentSlice } from './slices/editorContentSlice';
import { createEditorDocTabsSlice } from './slices/editorDocTabsSlice';
import {
	createEditorDocumentSlice,
	type EditorDocumentLoadGenRef,
} from './slices/editorDocumentSlice';
import { createEditorFileOpsSlice } from './slices/editorFileOpsSlice';
import { createEditorImageGenSlice } from './slices/editorImageGenSlice';
import { createEditorSearchPromptsSlice } from './slices/editorSearchPromptsSlice';
import { createEditorVersionsSlice } from './slices/editorVersionsSlice';

// Selectors for optimized re-renders
export const selectCurrentDocument = (
	state: EditorStore
): UltimateDocument | null => state.currentDocument;
export const selectIsDirty = (state: EditorStore): boolean => state.isDirty;
export const selectIsSaving = (state: EditorStore): boolean => state.isSaving;
export const selectSelectedText = (state: EditorStore): string =>
	state.selectedText;
export const selectAIPanelOpen = (state: EditorStore): boolean =>
	state.aiPanelOpen;
export const selectImageGenPanelOpen = (state: EditorStore): boolean =>
	state.imageGenPanelOpen;

export interface EditorStore extends EditorState, EditorActions {}
export type EditorStoreHook = UseBoundStore<StoreApi<EditorStore>>;

export const createEditorStoreHook = (): EditorStoreHook => {
	/**
	 * Увеличивается при каждом старте loadDocument; ответ с устаревшим номером игнорируется.
	 * Должен быть scoped per-store, чтобы разные окна редактора не гасили загрузку друг друга.
	 */
	const loadGenRef: EditorDocumentLoadGenRef = { current: 0 };

	const store = create<EditorStore>()(
		devtools(
			subscribeWithSelector(
				persist(
					(set, get, api) =>
						({
							currentDocument: null,
							documents: [],
							documentsTotal: 0,
							isLoading: false,
							isLoadingMoreDocuments: false,
							isLoadingDocument: false,
							documentSource: null,
							error: undefined,

							isDirty: false,
							isSaving: false,
							lastSaved: undefined,

							selectedText: '',
							cursorPosition: { line: 1, column: 1 },

							aiPanelOpen: false,
							aiStreaming: false,
							aiStreamingText: '',

							imageGenPanelOpen: false,
							isGeneratingImage: false,
							generatedImages: [],

							collabPanelOpen: false,
							activeCollaborators: [],

							searchPanelOpen: false,
							searchResults: [],

							savedPrompts: [],
							promptsPanelOpen: false,

							versionsPanelOpen: false,
							versions: [],

							fileManagerListCompact: false,
							aiFileManagerContext: null,

							documentVersionConflict: null,

							docTabOrder: [],
							docTabSessions: {},
							docTabTitles: {},

							...createEditorDocumentSlice(loadGenRef)(set, get, api),
							...createEditorContentSlice(set, get, api),
							...createEditorAiSlice()(set, get, api),
							...createEditorImageGenSlice()(set, get, api),
							...createEditorCollabSlice()(set, get, api),
							...createEditorDocTabsSlice(set, get, api),
							...createEditorSearchPromptsSlice()(set, get, api),
							...createEditorVersionsSlice()(set, get, api),
							...createEditorFileOpsSlice()(set, get, api),
						}) as EditorStore,
					{
						name: 'ultimate-doc-editor-storage',
						partialize: (state) => ({
							savedPrompts: state.savedPrompts,
							fileManagerListCompact: state.fileManagerListCompact,
						}),
					}
				)
			),
			{
				name: 'UltimateDocEditor',
				enabled: process.env.NODE_ENV === 'development',
			}
		)
	);

	store.subscribe((state, previous) => {
		if (
			state.error &&
			state.error !== previous.error &&
			typeof state.error === 'string'
		) {
			notify.error(i18n.t('ultimateDocEditor:store.toastTitle'), state.error);
		}
	});

	return store;
};

export const useEditorStore = createEditorStoreHook();
