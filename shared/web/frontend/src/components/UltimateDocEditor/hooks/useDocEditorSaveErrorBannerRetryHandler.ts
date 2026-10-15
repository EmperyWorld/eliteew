/**
 * Колбэк «Повторить» для {@link UltimateDocEditorSaveErrorBanner}: сброс pending HTML, PUT с expected_version вне коллаба.
 */

import { useCallback, type MutableRefObject } from 'react';

import type { StoreApi } from 'zustand';

import type { EditorStore } from '../store/editorStore';
import type { EditorActions } from '../types/editor.types';

export interface UseDocEditorSaveErrorBannerRetryHandlerParams {
	flushPendingEditorHtmlToStore: () => void;
	editorStoreApi: StoreApi<EditorStore>;
	updateDocument: EditorActions['updateDocument'];
	collaborationEnabledForEditorRef: MutableRefObject<boolean>;
}

export function useDocEditorSaveErrorBannerRetryHandler(
	params: UseDocEditorSaveErrorBannerRetryHandlerParams
): () => void {
	const {
		flushPendingEditorHtmlToStore,
		editorStoreApi,
		updateDocument,
		collaborationEnabledForEditorRef,
	} = params;

	return useCallback(() => {
		flushPendingEditorHtmlToStore();
		const doc = editorStoreApi.getState().currentDocument;
		if (!doc) return;
		const useForceSave = !collaborationEnabledForEditorRef.current;
		void updateDocument(
			{ content: doc.content },
			useForceSave
				? { forceSave: true }
				: {
						expectedVersion: doc.version ?? doc.version_number ?? null,
					}
		);
	}, [
		flushPendingEditorHtmlToStore,
		editorStoreApi.getState,
		updateDocument,
		collaborationEnabledForEditorRef,
	]);
}
