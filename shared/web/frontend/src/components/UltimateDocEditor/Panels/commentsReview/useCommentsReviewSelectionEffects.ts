/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Selection/focus effects: dual thread sync, scroll flash, composer selection, external action token.
 *
 * Invariants:
 * - onThreadsChange mirrors panel threads to session/TipTap anchors.
 * - externalThreadAction handshake calls onExternalThreadActionHandled with token.
 *
 * Related:
 * - useCommentsReviewMutations.ts, UltimateDocEditorPanelOverlays.tsx
 */

import { useEffect, useState } from 'react';

import type {
	CommentThread,
	ExternalCommentThreadAction,
} from '@/components/UltimateDocEditor/types/editor.types';
import type {
	CommentPanelTab,
	ThreadSelection,
} from '@/components/UltimateDocEditor/Panels/commentsReview/commentsReviewTypes';

export interface UseCommentsReviewSelectionEffectsParams {
	isOpen: boolean;
	activeTab: CommentPanelTab;
	threads: CommentThread[];
	onThreadsChange?: (threads: CommentThread[]) => void;
	focusedThreadId?: string | null;
	onFocusThread?: (threadId: string | null) => void;
	incomingSelection: ThreadSelection | null;
	composerSelection: ThreadSelection | null;
	setComposerSelection: (value: ThreadSelection | null) => void;
	externalThreadAction?: ExternalCommentThreadAction | null;
	onExternalThreadActionHandled?: (token: number) => void;
	handleResolveComment: (threadId: string) => Promise<void>;
	handleMarkThreadRead: (threadId: string) => Promise<void>;
	setActiveTab: (tab: CommentPanelTab) => void;
	setReplyingTo: (threadId: string | null) => void;
	setReplyText: (value: string) => void;
}

export function useCommentsReviewSelectionEffects({
	isOpen,
	activeTab,
	threads,
	onThreadsChange,
	focusedThreadId,
	onFocusThread,
	incomingSelection,
	composerSelection: _composerSelection,
	setComposerSelection,
	externalThreadAction,
	onExternalThreadActionHandled,
	handleResolveComment,
	handleMarkThreadRead,
	setActiveTab,
	setReplyingTo,
	setReplyText,
}: UseCommentsReviewSelectionEffectsParams) {
	const [flashFocusedThreadId, setFlashFocusedThreadId] = useState<
		string | null
	>(null);

	useEffect(() => {
		onThreadsChange?.(threads);
	}, [onThreadsChange, threads]);

	useEffect(() => {
		if (!isOpen || !focusedThreadId || activeTab !== 'comments') {
			return;
		}

		const element = document.querySelector<HTMLElement>(
			`[data-thread-id="${focusedThreadId}"]`
		);
		if (!element) {
			return;
		}

		element.scrollIntoView({ behavior: 'smooth', block: 'center' });
		setFlashFocusedThreadId(focusedThreadId);

		const timeoutId = window.setTimeout(() => {
			setFlashFocusedThreadId((current) =>
				current === focusedThreadId ? null : current
			);
		}, 1800);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [activeTab, focusedThreadId, isOpen]);

	useEffect(() => {
		if (!isOpen) {
			setComposerSelection(incomingSelection);
			return;
		}

		if (incomingSelection) {
			setComposerSelection(incomingSelection);
		}
	}, [incomingSelection, isOpen, setComposerSelection]);

	useEffect(() => {
		if (!isOpen || !externalThreadAction) {
			return;
		}

		setActiveTab('comments');
		onFocusThread?.(externalThreadAction.threadId);

		if (externalThreadAction.action === 'reply') {
			setReplyingTo(externalThreadAction.threadId);
			setReplyText('');
			onExternalThreadActionHandled?.(externalThreadAction.token);
			return;
		}

		void handleResolveComment(externalThreadAction.threadId).finally(() => {
			onExternalThreadActionHandled?.(externalThreadAction.token);
		});
	}, [
		externalThreadAction,
		handleResolveComment,
		isOpen,
		onExternalThreadActionHandled,
		onFocusThread,
		setActiveTab,
		setReplyText,
		setReplyingTo,
	]);

	useEffect(() => {
		if (!isOpen || !focusedThreadId || activeTab !== 'comments') {
			return;
		}
		void handleMarkThreadRead(focusedThreadId);
	}, [activeTab, focusedThreadId, handleMarkThreadRead, isOpen]);

	return { flashFocusedThreadId };
}
