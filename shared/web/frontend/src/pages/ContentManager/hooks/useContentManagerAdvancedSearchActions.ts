/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Owns advanced-search execution and reset handlers for Content Manager.
 *
 * Invariants:
 * - Empty queries never call the API.
 * - Pagination uses the shared advanced-search page size.
 *
 * Related:
 * - ContentManagerPro.tsx
 * - components/ContentManagerAdvancedSearch.tsx
 */
import { useCallback } from 'react';
import type { TFunction } from 'i18next';
import {
	contentApi,
	type ContentSearchResult,
} from '../../../services/contentApi';
import { getApiErrorMessage } from '../../../utils/apiError';

export const CONTENT_MANAGER_ADVANCED_PAGE_SIZE = 20;

type Options = {
	t: TFunction<'contentManager'>;
	advancedQuery: string;
	advancedTags: string;
	advancedContentType: string;
	advancedVisibility: string;
	advancedDateFrom: string;
	advancedDateTo: string;
	advancedSizeMin: string;
	advancedSizeMax: string;
	setAdvancedError: (value: string | null) => void;
	setAdvancedResults: React.Dispatch<
		React.SetStateAction<ContentSearchResult[]>
	>;
	setAdvancedTotal: (value: number) => void;
	setAdvancedPage: (value: number) => void;
	setAdvancedLoading: (value: boolean) => void;
	setAdvancedQuery: (value: string) => void;
	setAdvancedTags: (value: string) => void;
	setAdvancedContentType: (value: string) => void;
	setAdvancedVisibility: (
		value: import('../components/ContentManagerAdvancedSearch').AdvancedVisibilityFilter
	) => void;
	setAdvancedDateFrom: (value: string) => void;
	setAdvancedDateTo: (value: string) => void;
	setAdvancedSizeMin: (value: string) => void;
	setAdvancedSizeMax: (value: string) => void;
};

export function useContentManagerAdvancedSearchActions(options: Options) {
	const runAdvancedSearchPage = useCallback(
		async (page: number) => {
			const query = options.advancedQuery.trim();
			if (!query) {
				options.setAdvancedError(options.t('advancedSearch.errorNeedQuery'));
				options.setAdvancedResults([]);
				options.setAdvancedTotal(0);
				options.setAdvancedPage(1);
				return;
			}
			options.setAdvancedLoading(true);
			options.setAdvancedError(null);
			options.setAdvancedPage(page);
			try {
				const response = await contentApi.advancedSearch({
					query,
					content_types:
						options.advancedContentType !== 'all'
							? [options.advancedContentType]
							: undefined,
					tags: options.advancedTags
						.split(',')
						.map((tag) => tag.trim())
						.filter(Boolean),
					visibility:
						options.advancedVisibility !== 'all'
							? options.advancedVisibility
							: undefined,
					date_from: options.advancedDateFrom || undefined,
					date_to: options.advancedDateTo || undefined,
					file_size_min: options.advancedSizeMin
						? Number(options.advancedSizeMin)
						: undefined,
					file_size_max: options.advancedSizeMax
						? Number(options.advancedSizeMax)
						: undefined,
					limit: CONTENT_MANAGER_ADVANCED_PAGE_SIZE,
					offset: (page - 1) * CONTENT_MANAGER_ADVANCED_PAGE_SIZE,
				});
				options.setAdvancedTotal(response.total);
				options.setAdvancedResults(response.results);
			} catch (error) {
				options.setAdvancedResults([]);
				options.setAdvancedTotal(0);
				options.setAdvancedError(getApiErrorMessage(error));
			} finally {
				options.setAdvancedLoading(false);
			}
		},
		[options]
	);
	const clearAdvancedSearch = useCallback(() => {
		options.setAdvancedQuery('');
		options.setAdvancedTags('');
		options.setAdvancedContentType('all');
		options.setAdvancedVisibility('all');
		options.setAdvancedDateFrom('');
		options.setAdvancedDateTo('');
		options.setAdvancedSizeMin('');
		options.setAdvancedSizeMax('');
		options.setAdvancedResults([]);
		options.setAdvancedTotal(0);
		options.setAdvancedError(null);
		options.setAdvancedPage(1);
	}, [options]);
	return { runAdvancedSearchPage, clearAdvancedSearch };
}
