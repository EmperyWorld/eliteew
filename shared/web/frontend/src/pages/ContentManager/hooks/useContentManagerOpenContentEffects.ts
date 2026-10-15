/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Resolves Content Manager deep links and desktop focus payloads into selected/open preview state.
 *
 * Invariants:
 * - Opening by id works even when the current list page or filters do not contain that row.
 * - Session/hash deep-link ids are consumed once.
 *
 * Related:
 * - `ContentManagerPro.tsx`
 * - `desktopDeepLink.ts`
 */
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef } from 'react';
import type { TFunction } from 'i18next';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import { contentApi } from '../../../services/contentApi';
import {
	CONTENT_MANAGER_OPEN_CONTENT,
	readContentManagerDeepLink,
} from '../../Desktop/utils/desktopDeepLink';

export type UseContentManagerOpenContentEffectsParams = {
	items: ContentItem[];
	pendingOpenContentId: string | null;
	setPendingOpenContentId: Dispatch<SetStateAction<string | null>>;
	setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
	setPreviewItem: Dispatch<SetStateAction<ContentItem | null>>;
	setError: Dispatch<SetStateAction<string | null>>;
	t: TFunction<'contentManager'>;
	initialFocusUnifiedContentId?: string | null;
	initialOpenAssignProject?: boolean;
	onOpenAssignProject?: () => void;
	onContentOpened?: (item: ContentItem) => void;
};

/**
 * Listen for `CONTENT_MANAGER_OPEN_CONTENT` (desktop folder «open»).
 * Resolve deep link from storage or open by id (fetch if not in current list).
 */
export function useContentManagerOpenContentEffects({
	items,
	pendingOpenContentId,
	setPendingOpenContentId,
	setSelectedIds,
	setPreviewItem,
	setError,
	t,
	initialFocusUnifiedContentId = null,
	initialOpenAssignProject = false,
	onOpenAssignProject,
	onContentOpened,
}: UseContentManagerOpenContentEffectsParams): void {
	const initialFocusAppliedRef = useRef<string | null>(null);
	const itemsRef = useRef(items);

	useEffect(() => {
		itemsRef.current = items;
	}, [items]);

	useEffect(() => {
		const handler = (e: Event) => {
			const id = (e as CustomEvent<{ contentId?: string }>).detail?.contentId;
			if (id) setPendingOpenContentId(id);
		};
		window.addEventListener(CONTENT_MANAGER_OPEN_CONTENT, handler);
		return () =>
			window.removeEventListener(CONTENT_MANAGER_OPEN_CONTENT, handler);
	}, [setPendingOpenContentId]);

	useEffect(() => {
		const focusId = initialFocusUnifiedContentId?.trim() || null;
		const shouldApplyInitialFocus =
			pendingOpenContentId == null &&
			focusId != null &&
			initialFocusAppliedRef.current !== focusId;
		const contentId =
			pendingOpenContentId ??
			(shouldApplyInitialFocus ? focusId : null) ??
			readContentManagerDeepLink();
		if (!contentId) return;
		const shouldOpenAssignProject =
			shouldApplyInitialFocus && initialOpenAssignProject;
		if (shouldApplyInitialFocus) {
			initialFocusAppliedRef.current = focusId;
		}
		const item = itemsRef.current.find((i) => i.id === contentId);
		if (item) {
			setSelectedIds(new Set([contentId]));
			setPreviewItem(item);
			onContentOpened?.(item);
			if (shouldOpenAssignProject) onOpenAssignProject?.();
			if (pendingOpenContentId) setPendingOpenContentId(null);
			return;
		}
		let cancelled = false;
		contentApi
			.getContent(contentId)
			.then((fetched) => {
				if (!cancelled && fetched) {
					setSelectedIds(new Set([contentId]));
					setPreviewItem(fetched);
					onContentOpened?.(fetched);
					if (shouldOpenAssignProject) onOpenAssignProject?.();
				}
			})
			.catch(() => {
				if (!cancelled) setError(t('errors.fileNotFound'));
			})
			.finally(() => {
				if (pendingOpenContentId) setPendingOpenContentId(null);
			});
		return () => {
			cancelled = true;
		};
	}, [
		initialFocusUnifiedContentId,
		initialOpenAssignProject,
		onContentOpened,
		onOpenAssignProject,
		pendingOpenContentId,
		setError,
		setPendingOpenContentId,
		setPreviewItem,
		setSelectedIds,
		t,
	]);
}
