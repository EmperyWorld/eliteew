import type { Content as ContentItem } from '../../../components/UnifiedContent/types';

/** In-place: newest `updated_at` (fallback `created_at`) first. */
export function sortItemsByNewestUpdatedFirst(items: ContentItem[]): void {
	items.sort((a, b) => {
		const ta = new Date(a.updated_at ?? a.created_at).getTime();
		const tb = new Date(b.updated_at ?? b.created_at).getTime();
		return tb - ta;
	});
}
