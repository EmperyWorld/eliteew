import type { ContentListQuery } from '@/services/contentApi';

/** Стабильный ключ TanStack Query для списка пикера. */
export function unifiedContentPickerQueryKey(
	listParams: ContentListQuery
): readonly unknown[] {
	return [
		'unified-content-picker',
		listParams.limit ?? null,
		listParams.offset ?? null,
		listParams.search ?? '',
		listParams.content_type ?? null,
		listParams.visibility ?? null,
		listParams.folder_item_id ?? null,
		listParams.folder_unassigned ?? null,
		listParams.company_id ?? null,
		listParams.project_id ?? null,
		listParams.sort_field ?? null,
		listParams.sort_order ?? null,
		listParams.source_service ?? null,
		listParams.owner_only ?? null,
	] as const;
}
