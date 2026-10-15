/**
 * 🔥💎 useDocument Hook 💎🔥
 *
 * Custom hook for document CRUD operations
 *
 * Created: 2025-10-18
 */

import { useCallback } from 'react';
import {
	useEditorStoreApi,
	useEditorStoreShallow,
} from '../store/editorStoreContext';
import { selectUseDocumentSlice } from '../store/editorStoreSelectors';
import type {
	ListDocumentsParams,
	UltimateDocument,
	UseDocumentReturn,
} from '../types/editor.types';

/**
 * Hook for managing document operations
 *
 * @example
 * ```tsx
 * const { document, isLoading, createDocument, loadDocument } = useDocument();
 *
 * // Create new document
 * await createDocument('My Document', '<p>Initial content</p>');
 *
 * // Load existing document
 * await loadDocument('document-uuid');
 * ```
 */
export const useDocument = (): UseDocumentReturn => {
	const editorStoreApi = useEditorStoreApi();
	const {
		currentDocument,
		isLoading,
		error,
		createDocument: storeCreate,
		loadDocument: storeLoad,
		updateDocument: storeUpdate,
		deleteDocument: storeDelete,
		listDocuments: storeList,
	} = useEditorStoreShallow(selectUseDocumentSlice);

	const createDocument = useCallback(
		async (title: string, content = ''): Promise<UltimateDocument> => {
			await storeCreate(title, content);
			const { currentDocument } = editorStoreApi.getState();
			if (!currentDocument) {
				throw new Error('Failed to create document');
			}
			return currentDocument;
		},
		[storeCreate, editorStoreApi]
	);

	const loadDocument = useCallback(
		async (id: string): Promise<UltimateDocument> => {
			await storeLoad(id);
			const { currentDocument } = editorStoreApi.getState();
			if (!currentDocument) {
				throw new Error('Failed to load document');
			}
			return currentDocument;
		},
		[storeLoad, editorStoreApi]
	);

	const updateDocument = useCallback(
		async (
			_id: string,
			updates: Partial<UltimateDocument>
		): Promise<UltimateDocument> => {
			await storeUpdate(updates);
			const { currentDocument } = editorStoreApi.getState();
			if (!currentDocument) {
				throw new Error('Failed to update document');
			}
			return currentDocument;
		},
		[storeUpdate, editorStoreApi]
	);

	const deleteDocument = useCallback(
		async (id: string): Promise<void> => {
			await storeDelete(id);
		},
		[storeDelete]
	);

	const listDocuments = useCallback(
		async (params?: ListDocumentsParams): Promise<UltimateDocument[]> => {
			await storeList(params);
			const { documents } = editorStoreApi.getState();
			return documents;
		},
		[storeList, editorStoreApi]
	);

	return {
		document: currentDocument ?? undefined,
		isLoading,
		error,
		createDocument,
		loadDocument,
		updateDocument,
		deleteDocument,
		listDocuments,
	};
};
