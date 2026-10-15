/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Syncs list rows and preview item when unified content blob metadata changes out-of-band.
 *
 * Invariants:
 * - Patch is limited to updated_at and file_size fields on matching rows.
 *
 * Related:
 * - ContentManagerPro.tsx, unifiedContentEvents.ts
 */
import type { Dispatch, SetStateAction } from 'react';
import { useEffect } from 'react';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import {
	type UnifiedContentBlobUpdatedDetail,
	UNIFIED_CONTENT_BLOB_UPDATED_EVENT,
} from '../../../services/unifiedContentEvents';

export type UseContentManagerBlobUpdateSyncParams = {
	fetchContent: () => void | Promise<void>;
	setPreviewItem: Dispatch<SetStateAction<ContentItem | null>>;
	setItems: Dispatch<SetStateAction<ContentItem[]>>;
};

export function useContentManagerBlobUpdateSync({
	fetchContent,
	setPreviewItem,
	setItems,
}: UseContentManagerBlobUpdateSyncParams) {
	useEffect(() => {
		const handler = (event: Event) => {
			const detail = (event as CustomEvent<UnifiedContentBlobUpdatedDetail>)
				.detail;
			if (!detail?.contentId) return;
			void fetchContent();
			setPreviewItem((previous) =>
				previous?.id === detail.contentId
					? {
							...previous,
							updated_at: detail.updated_at,
							file_size: detail.file_size,
						}
					: previous
			);
			setItems((current) =>
				current.map((item) =>
					item.id === detail.contentId
						? {
								...item,
								updated_at: detail.updated_at,
								file_size: detail.file_size,
							}
						: item
				)
			);
		};
		window.addEventListener(UNIFIED_CONTENT_BLOB_UPDATED_EVENT, handler);
		return () =>
			window.removeEventListener(UNIFIED_CONTENT_BLOB_UPDATED_EVENT, handler);
	}, [fetchContent, setItems, setPreviewItem]);
}
