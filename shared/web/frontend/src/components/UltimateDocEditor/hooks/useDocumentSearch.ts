/**
 * 🔥💎 useDocumentSearch Hook 💎🔥
 *
 * Custom hook for document search (full-text + semantic)
 *
 * Created: 2025-10-18
 */

import { useCallback } from 'react';
import {
	useEditorStoreApi,
	useEditorStoreShallow,
} from '../store/editorStoreContext';
import { selectDocumentSearchSlice } from '../store/editorStoreSelectors';
import type { UseDocumentSearchReturn } from '../types/editor.types';

/**
 * Hook for searching documents
 *
 * @example
 * ```tsx
 * const { results, isSearching, search, clearResults } = useDocumentSearch();
 *
 * // Full-text search
 * await search('my query', 'fulltext');
 *
 * // Semantic search
 * await search('find documents about AI', 'semantic');
 * ```
 */
export const useDocumentSearch = (): UseDocumentSearchReturn => {
	const editorStoreApi = useEditorStoreApi();
	const {
		searchResults,
		isLoading,
		error,
		search: storeSearch,
	} = useEditorStoreShallow(selectDocumentSearchSlice);

	const search = useCallback(
		async (
			query: string,
			searchType: 'fulltext' | 'semantic'
		): Promise<void> => {
			await storeSearch(query, searchType);
		},
		[storeSearch]
	);

	const clearResults = useCallback(() => {
		editorStoreApi.setState({ searchResults: [] });
	}, [editorStoreApi]);

	return {
		results: searchResults,
		isSearching: isLoading,
		error,
		search,
		clearResults,
	};
};
