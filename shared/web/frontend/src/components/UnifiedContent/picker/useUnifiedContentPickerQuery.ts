import { contentApi, type ContentListQuery } from '@/services/contentApi';
import { useQuery } from '@tanstack/react-query';
import { unifiedContentPickerQueryKey } from './unifiedContentPickerQueryKey';

export type UseUnifiedContentPickerQueryOptions = Readonly<{
	enabled: boolean;
	/** Параметры GET /content (включая search для серверного поиска). */
	listParams: ContentListQuery;
	staleTimeMs?: number;
}>;

export function useUnifiedContentPickerQuery({
	enabled,
	listParams,
	staleTimeMs = 15_000,
}: UseUnifiedContentPickerQueryOptions) {
	return useQuery({
		queryKey: unifiedContentPickerQueryKey(listParams),
		queryFn: () =>
			contentApi.listContent({
				...listParams,
				list_profile: listParams.list_profile ?? 'compact',
			}),
		enabled,
		staleTime: staleTimeMs,
	});
}
