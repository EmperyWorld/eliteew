import type { Content } from '@/components/UnifiedContent/types';
import type { ContentListQuery } from '@/services/contentApi';
import {
	ContentType,
	type ContentType as ContentTypeT,
	createFileId,
	type FileId,
} from '@/types/fileExchange';
import {
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useState,
} from 'react';
import { normalizePickerContentType } from './pickerContentTypeUtils';
import { useUnifiedContentPickerQuery } from './useUnifiedContentPickerQuery';

export type PickerItem = Content & {
	readonly _pickerContentType: ContentTypeT;
};

export type UseUnifiedContentPickerControllerArgs = Readonly<{
	enabled: boolean;
	baseListParams: ContentListQuery;
	allowedContentTypes?: readonly ContentTypeT[];
	multiSelect: boolean;
	maxFiles: number;
}>;

export function useUnifiedContentPickerController({
	enabled,
	baseListParams,
	allowedContentTypes,
	multiSelect,
	maxFiles,
}: UseUnifiedContentPickerControllerArgs) {
	const [searchQuery, setSearchQuery] = useState('');
	const deferredSearch = useDeferredValue(searchQuery);
	const [filterType, setFilterType] = useState<ContentTypeT | 'all'>('all');
	const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);

	const listParams = useMemo((): ContentListQuery => {
		const search = deferredSearch.trim();
		const singleType =
			allowedContentTypes?.length === 1 ? allowedContentTypes[0] : undefined;
		return {
			...baseListParams,
			...(search ? { search } : {}),
			...(singleType ? { content_type: singleType } : {}),
		};
	}, [baseListParams, deferredSearch, allowedContentTypes]);

	const query = useUnifiedContentPickerQuery({ enabled, listParams });

	const normalizedItems = useMemo((): readonly PickerItem[] => {
		const raw = query.data?.items ?? [];
		return raw.map((c) => ({
			...c,
			_pickerContentType: normalizePickerContentType({
				content_type: c.content_type,
				mime_type: c.mime_type,
			}),
		}));
	}, [query.data?.items]);

	const filteredItems = useMemo((): readonly PickerItem[] => {
		let list = [...normalizedItems];
		if (filterType !== 'all') {
			list = list.filter((i) => i._pickerContentType === filterType);
		}
		if (allowedContentTypes && allowedContentTypes.length > 1) {
			const set = new Set(allowedContentTypes);
			list = list.filter((i) => set.has(i._pickerContentType));
		}
		return list;
	}, [normalizedItems, filterType, allowedContentTypes]);

	const availableTypes = useMemo((): readonly ContentTypeT[] => {
		const types = new Set(normalizedItems.map((i) => i._pickerContentType));
		return Array.from(types);
	}, [normalizedItems]);

	const toggleId = useCallback(
		(id: string, onMaxReached?: () => void): void => {
			if (multiSelect) {
				setSelectedIds((prev) => {
					if (prev.includes(id)) {
						return prev.filter((x) => x !== id);
					}
					if (prev.length >= maxFiles) {
						onMaxReached?.();
						return prev;
					}
					return [...prev, id];
				});
			} else {
				setSelectedIds([id]);
			}
		},
		[multiSelect, maxFiles]
	);

	const selectAllVisible = useCallback((): void => {
		const ids = filteredItems.slice(0, maxFiles).map((i) => i.id);
		setSelectedIds(ids);
	}, [filteredItems, maxFiles]);

	const deselectAll = useCallback((): void => {
		setSelectedIds([]);
	}, []);

	const clearSelection = useCallback((): void => {
		setSelectedIds([]);
	}, []);

	useEffect(() => {
		if (!enabled) {
			setSearchQuery('');
			setFilterType('all');
			setSelectedIds([]);
		}
	}, [enabled]);

	const selectedItems = useMemo(() => {
		const set = new Set(selectedIds);
		return filteredItems.filter((i) => set.has(i.id));
	}, [filteredItems, selectedIds]);

	const toFileIds = useCallback(
		(ids: readonly string[]): readonly FileId[] =>
			ids.map((id) => createFileId(id)),
		[]
	);

	return {
		searchQuery,
		setSearchQuery,
		deferredSearch,
		searchPending: searchQuery !== deferredSearch,
		filterType,
		setFilterType,
		selectedIds,
		setSelectedIds,
		toggleId,
		selectAllVisible,
		deselectAll,
		clearSelection,
		listParams,
		query,
		normalizedItems,
		filteredItems,
		availableTypes,
		selectedItems,
		toFileIds,
	};
}

/** Для типов по умолчанию «все документы» как в FileLibraryPanel */
export const DEFAULT_DOCUMENT_LIBRARY_TYPES: readonly ContentTypeT[] = [
	ContentType.DOCUMENT,
	ContentType.IMAGE,
	ContentType.OTHER,
];
