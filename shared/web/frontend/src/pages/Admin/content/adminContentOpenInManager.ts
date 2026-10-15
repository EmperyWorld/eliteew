/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Open unified content in Content Manager from Admin Content Ops (embedded desktop or global deep-link).
 *
 * Invariants:
 * - Prefers DesktopAppProps `openContentManager` when Admin runs inside the desktop shell.
 *
 * Related:
 * - `ContentProcessingFailuresTab.tsx`
 * - `pages/Desktop/utils/desktopDeepLink.ts`
 */

import { useCallback } from 'react';
import { useDesktopAppProps } from '../../Desktop/context/DesktopAppPropsContext';
import { requestOpenContentManager } from '../../Desktop/utils/desktopDeepLink';
import type { WindowInitialPayload } from '../../Desktop/types/desktop.types';

export function openAdminContentInManager(
	contentId: string,
	openContentManager?: (payload?: Partial<WindowInitialPayload>) => void
): void {
	const id = contentId.trim();
	if (!id) return;
	if (openContentManager) {
		openContentManager({ contentManagerFocusUnifiedContentId: id });
		return;
	}
	requestOpenContentManager(id);
}

export function useAdminOpenContentInManager(): (contentId: string) => void {
	const desktopProps = useDesktopAppProps();
	return useCallback(
		(contentId: string) =>
			openAdminContentInManager(contentId, desktopProps?.openContentManager),
		[desktopProps?.openContentManager]
	);
}

export function contentProcessingFailureLabel(row: {
	id: string;
	name: string | null;
	title: string | null;
}): string {
	return row.name?.trim() || row.title?.trim() || row.id;
}
