/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Client-side filter, sort, and aggregate helpers for comment thread lists.
 *
 * Related:
 * - useCommentsReviewCompose.ts, CommentsReviewFiltersBar.tsx
 */

import type { CommentThread } from '@/components/UltimateDocEditor/types/editor.types';

import type {
	CommentAuthorOption,
	ThreadQueueMode,
	ThreadSelection,
	ThreadSortMode,
} from '@/components/UltimateDocEditor/Panels/commentsReview/commentsReviewTypes';

export interface FilterCommentThreadsParams {
	threads: CommentThread[];
	filterResolved: boolean;
	selectedAuthorId: string;
	threadQueueMode: ThreadQueueMode;
	searchQuery: string;
	currentUserId: string;
	incomingSelection: ThreadSelection | null;
}

export function buildAuthorOptions(
	threads: CommentThread[]
): CommentAuthorOption[] {
	const authorMap = new Map<string, string>();
	threads.forEach((thread) => {
		thread.comments.forEach((comment) => {
			if (!authorMap.has(comment.author.id)) {
				authorMap.set(comment.author.id, comment.author.name);
			}
		});
	});
	return Array.from(authorMap.entries()).map(([id, name]) => ({ id, name }));
}

export function filterCommentThreads({
	threads,
	filterResolved,
	selectedAuthorId,
	threadQueueMode,
	searchQuery,
	currentUserId,
	incomingSelection,
}: FilterCommentThreadsParams): CommentThread[] {
	return threads.filter((thread) => {
		if (filterResolved && thread.comments.every((c) => c.resolved)) {
			return false;
		}
		if (
			selectedAuthorId !== 'all' &&
			!thread.comments.some((comment) => comment.author.id === selectedAuthorId)
		) {
			return false;
		}
		if (
			threadQueueMode === 'assigned_to_me' &&
			thread.assignedReviewer?.id !== currentUserId
		) {
			return false;
		}
		if (threadQueueMode === 'unresolved_in_selection') {
			const unresolved = thread.comments.some((comment) => !comment.resolved);
			if (!unresolved) {
				return false;
			}
			if (incomingSelection && thread.selection) {
				const overlaps =
					thread.selection.start < incomingSelection.end &&
					thread.selection.end > incomingSelection.start;
				if (!overlaps) {
					return false;
				}
			} else if (!thread.selection) {
				return false;
			}
		}
		if (threadQueueMode === 'recently_changed') {
			const latest =
				thread.lastActivityAt?.getTime() ??
				thread.comments[0]?.createdAt.getTime() ??
				0;
			if (Date.now() - latest > 1000 * 60 * 60 * 24 * 2) {
				return false;
			}
		}
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			return thread.comments.some(
				(c) =>
					c.content.toLowerCase().includes(query) ||
					c.author.name.toLowerCase().includes(query)
			);
		}
		return true;
	});
}

export function sortCommentThreads(
	filtered: CommentThread[],
	threadSortMode: ThreadSortMode
): CommentThread[] {
	const withMeta = filtered.map((thread) => {
		const latestMs = thread.comments.reduce((max, comment) => {
			const ms = comment.createdAt.getTime();
			return ms > max ? ms : max;
		}, 0);
		const unresolved = thread.comments.some((comment) => !comment.resolved);
		return { thread, latestMs, unresolved };
	});

	withMeta.sort((a, b) => {
		const aPinned = a.thread.isPinned ? 1 : 0;
		const bPinned = b.thread.isPinned ? 1 : 0;
		if (aPinned !== bPinned) {
			return bPinned - aPinned;
		}
		switch (threadSortMode) {
			case 'oldest':
				return a.latestMs - b.latestMs;
			case 'open_first':
				if (a.unresolved !== b.unresolved) {
					return a.unresolved ? -1 : 1;
				}
				return b.latestMs - a.latestMs;
			default:
				return b.latestMs - a.latestMs;
		}
	});

	return withMeta.map((item) => item.thread);
}

export function countUnresolvedThreads(threads: CommentThread[]): number {
	return threads.reduce(
		(count, thread) =>
			count + (thread.comments.some((c) => !c.resolved) ? 1 : 0),
		0
	);
}

export function partitionVisibleThreadIds(sortedComments: CommentThread[]): {
	unresolvedVisibleThreadIds: string[];
	resolvedVisibleThreadIds: string[];
} {
	const unresolvedVisibleThreadIds = sortedComments
		.filter((thread) => thread.comments.some((comment) => !comment.resolved))
		.map((thread) => thread.id);
	const resolvedVisibleThreadIds = sortedComments
		.filter(
			(thread) =>
				thread.comments.length > 0 &&
				thread.comments.every((comment) => comment.resolved)
		)
		.map((thread) => thread.id);
	return { unresolvedVisibleThreadIds, resolvedVisibleThreadIds };
}
