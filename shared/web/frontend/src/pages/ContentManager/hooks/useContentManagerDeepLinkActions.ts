/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Deep-link open-by-id and recent-files registration for Content Manager desktop focus flows.
 *
 * Invariants:
 * - Opening by id fetches details even when the row is off the current list page.
 *
 * Related:
 * - ContentManagerPro.tsx, useContentManagerOpenContentEffects.ts
 */
import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { getApiErrorMessage } from '../../../utils/apiError';
import { emitDesktopFileOpened } from '../../Desktop/hooks/useRecentFiles';
import { mapContentTypeToRecentType } from '../utils/mapContentTypeToRecentType';

export type UseContentManagerDeepLinkActionsParams = {
	setError: (message: string | null) => void;
	setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
	setPreviewItem: Dispatch<SetStateAction<ContentItem | null>>;
	fetchSelectedContentDetails: (id: string) => Promise<ContentItem>;
	registerView: (item: ContentItem) => void | Promise<void>;
	setAssignTenancyOpen: (open: boolean) => void;
};

export function useContentManagerDeepLinkActions({
	setError,
	setSelectedIds,
	setPreviewItem,
	fetchSelectedContentDetails,
	registerView,
	setAssignTenancyOpen,
}: UseContentManagerDeepLinkActionsParams) {
	const handleContentOpenedFromDeepLink = useCallback(
		(content: ContentItem) => {
			void registerView(content);
			emitDesktopFileOpened({
				id: content.id,
				name: content.name,
				type: mapContentTypeToRecentType(content.content_type),
				path: `/content/${content.id}`,
			});
		},
		[registerView]
	);

	const openContentById = useCallback(
		async (contentId: string) => {
			try {
				const content = await fetchSelectedContentDetails(contentId);
				setSelectedIds(new Set([contentId]));
				setPreviewItem(content);
				handleContentOpenedFromDeepLink(content);
			} catch (err) {
				setError(getApiErrorMessage(err));
			}
		},
		[
			fetchSelectedContentDetails,
			handleContentOpenedFromDeepLink,
			setPreviewItem,
			setSelectedIds,
			setError,
		]
	);

	const openAssignProjectFromDeepLink = useCallback(() => {
		setAssignTenancyOpen(true);
	}, [setAssignTenancyOpen]);

	return {
		handleContentOpenedFromDeepLink,
		openContentById,
		openAssignProjectFromDeepLink,
	} as const;
}
