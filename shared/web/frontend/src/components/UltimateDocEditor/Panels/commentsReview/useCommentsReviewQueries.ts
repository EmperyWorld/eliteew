/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Loads comment threads and server capabilities for CommentsReviewPanel.
 *
 * Invariants:
 * - Capabilities reset when documentId changes; API capabilities win over permissionRole.
 *
 * Related:
 * - mapCommentApi.ts, useCommentsReviewMutations.ts
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TFunction } from 'i18next';

import { fetchCommentThreads } from '@/components/UltimateDocEditor/api/docEditorCommentsApi';
import { mapApiThreadToCommentThread } from '@/components/UltimateDocEditor/Panels/commentsReview/mapCommentApi';
import type { CommentThread } from '@/components/UltimateDocEditor/types/editor.types';
import { resolveCommentPanelCapabilities } from '@/components/UltimateDocEditor/utils/resolveCommentPanelCapabilities';

export interface UseCommentsReviewQueriesParams {
	documentId: string | undefined;
	isOpen: boolean;
	t: TFunction;
}

export function useCommentsReviewQueries({
	documentId,
	isOpen,
	t,
}: UseCommentsReviewQueriesParams) {
	const [threads, setThreads] = useState<CommentThread[]>([]);
	const [commentsLoading, setCommentsLoading] = useState(false);
	const [commentsError, setCommentsError] = useState<string | null>(null);
	const [apiCapabilities, setApiCapabilities] = useState<Record<
		string,
		boolean
	> | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset capabilities on document change
	useEffect(() => {
		setApiCapabilities(null);
	}, [documentId]);

	const loadThreads = useCallback(async () => {
		if (!documentId) {
			setThreads([]);
			setCommentsError(t('comments.errors.needSavedDoc'));
			return;
		}
		setCommentsLoading(true);
		setCommentsError(null);
		try {
			const { threads: apiThreads, capabilities } =
				await fetchCommentThreads(documentId);
			setApiCapabilities(capabilities ?? null);
			const mapped = apiThreads.map(mapApiThreadToCommentThread);
			setThreads(mapped);
		} catch (e) {
			const raw = e instanceof Error ? e.message : String(e);
			const message =
				raw.length > 180 ||
				/Traceback|File "|500|Internal Server Error/i.test(raw)
					? t('comments.loadErrorTitle')
					: raw;
			console.warn('[CommentsReviewPanel] Load comments failed', e);
			setCommentsError(message);
			setThreads([]);
			setApiCapabilities(null);
		} finally {
			setCommentsLoading(false);
		}
	}, [documentId, t]);

	useEffect(() => {
		if (isOpen) {
			void loadThreads();
		}
	}, [isOpen, loadThreads]);

	const {
		canWriteComments,
		canManageThreads,
		canResolveThreads,
		canAssignReviewer,
		capabilitiesKnown,
	} = useMemo(
		() => resolveCommentPanelCapabilities(apiCapabilities),
		[apiCapabilities]
	);

	return {
		threads,
		setThreads,
		commentsLoading,
		commentsError,
		apiCapabilities,
		loadThreads,
		canWriteComments,
		canManageThreads,
		canResolveThreads,
		canAssignReviewer,
		capabilitiesKnown,
		canUpdateReviewStatus: canManageThreads,
	};
}
