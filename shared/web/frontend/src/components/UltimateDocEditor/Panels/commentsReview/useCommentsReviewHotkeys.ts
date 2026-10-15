/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Alt+keyboard shortcuts for thread navigation, composer focus, resolve/reopen, next actionable.
 *
 * Related:
 * - useCommentsReviewCompose.ts, CommentsReviewFiltersBar.tsx
 */

import { useEffect } from 'react';
import type { RefObject } from 'react';

import type { CommentThread } from '@/components/UltimateDocEditor/types/editor.types';
import type { CommentPanelTab } from '@/components/UltimateDocEditor/Panels/commentsReview/commentsReviewTypes';

export interface UseCommentsReviewHotkeysParams {
	isOpen: boolean;
	activeTab: CommentPanelTab;
	sortedComments: CommentThread[];
	focusedThreadId?: string | null;
	onFocusThread?: (threadId: string | null) => void;
	replyingTo: string | null;
	newCommentInputRef: RefObject<HTMLInputElement | null>;
	replyInputRef: RefObject<HTMLInputElement | null>;
	handleResolveComment: (threadId: string) => Promise<void>;
	handleReopenComment: (threadId: string) => Promise<void>;
	focusNextActionableThread: () => void;
}

export function useCommentsReviewHotkeys({
	isOpen,
	activeTab,
	sortedComments,
	focusedThreadId,
	onFocusThread,
	replyingTo,
	newCommentInputRef,
	replyInputRef,
	handleResolveComment,
	handleReopenComment,
	focusNextActionableThread,
}: UseCommentsReviewHotkeysParams) {
	useEffect(() => {
		if (!isOpen || activeTab !== 'comments') {
			return;
		}

		const moveFocusBy = (step: number): void => {
			if (sortedComments.length === 0) {
				return;
			}
			const currentIndex = sortedComments.findIndex(
				(thread) => thread.id === focusedThreadId
			);
			const nextIndex =
				currentIndex === -1
					? 0
					: (currentIndex + step + sortedComments.length) %
						sortedComments.length;
			onFocusThread?.(sortedComments[nextIndex]?.id ?? null);
		};

		const handleHotkeys = (event: KeyboardEvent): void => {
			if (!event.altKey || event.ctrlKey || event.metaKey) {
				return;
			}
			const key = event.key.toLowerCase();

			if (key === 'j') {
				event.preventDefault();
				moveFocusBy(1);
				return;
			}
			if (key === 'k') {
				event.preventDefault();
				moveFocusBy(-1);
				return;
			}
			if (key === 'n') {
				event.preventDefault();
				newCommentInputRef.current?.focus();
				return;
			}
			if (key === 'm') {
				event.preventDefault();
				if (replyingTo) {
					replyInputRef.current?.focus();
				}
				return;
			}
			if (key === 'r') {
				if (!focusedThreadId) {
					return;
				}
				if (!event.shiftKey) {
					event.preventDefault();
					void handleResolveComment(focusedThreadId);
					return;
				}
				event.preventDefault();
				void handleReopenComment(focusedThreadId);
				return;
			}
			if (key === 'l') {
				event.preventDefault();
				focusNextActionableThread();
			}
		};

		window.addEventListener('keydown', handleHotkeys);
		return () => window.removeEventListener('keydown', handleHotkeys);
	}, [
		activeTab,
		focusNextActionableThread,
		focusedThreadId,
		handleReopenComment,
		handleResolveComment,
		isOpen,
		newCommentInputRef,
		onFocusThread,
		replyInputRef,
		replyingTo,
		sortedComments,
	]);
}
