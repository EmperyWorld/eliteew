/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Composes CommentsReviewPanel hooks, derived state, mutations, and list layout inputs.
 *
 * Related:
 * - CommentsReviewPanel.tsx, useCommentsReviewQueries.ts
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useResizeObserverRect } from '@hooks/useResizeObserverRect';
import { useDocEditorSidePanelZIndex } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { useNotifications } from '@/notifications';
import { REVIEW_STATUS_UI } from '@/components/UltimateDocEditor/Panels/commentsReview/commentsReviewConstants';
import {
	buildAuthorOptions,
	countUnresolvedThreads,
	filterCommentThreads,
	partitionVisibleThreadIds,
	sortCommentThreads,
} from '@/components/UltimateDocEditor/Panels/commentsReview/filterSortCommentThreads';
import { createFormatCommentRelativeTime } from '@/components/UltimateDocEditor/Panels/commentsReview/formatCommentRelativeTime';
import type { CommentsReviewPanelProps } from '@/components/UltimateDocEditor/Panels/commentsReview/commentsReviewTypes';
import { useCommentMentions } from '@/components/UltimateDocEditor/Panels/commentsReview/useCommentMentions';
import { useCommentsReviewHotkeys } from '@/components/UltimateDocEditor/Panels/commentsReview/useCommentsReviewHotkeys';
import { useCommentsReviewMutations } from '@/components/UltimateDocEditor/Panels/commentsReview/useCommentsReviewMutations';
import { useCommentsReviewQueries } from '@/components/UltimateDocEditor/Panels/commentsReview/useCommentsReviewQueries';
import { useCommentsReviewSelectionEffects } from '@/components/UltimateDocEditor/Panels/commentsReview/useCommentsReviewSelectionEffects';
import type { ReviewStatus } from '@/components/UltimateDocEditor/types/editor.types';
import { getNextActionableThreadId } from '@/components/UltimateDocEditor/utils/commentsQueue';
import type { ThreadSelection } from '@/components/UltimateDocEditor/Panels/commentsReview/commentsReviewTypes';

export function useCommentsReviewCompose({
	isOpen,
	documentId,
	selectedText: selectedTextProp,
	selectionRange,
	onJumpToSelection,
	onThreadsChange,
	onFocusThread,
	focusedThreadId,
	externalThreadAction,
	onExternalThreadActionHandled,
	currentUser = { id: 'user-1', name: 'Current User' },
}: CommentsReviewPanelProps) {
	const { t } = useTranslation('docEditorPanels');
	const { success, error: showError } = useNotifications();
	const docSidePanelZ = useDocEditorSidePanelZIndex();

	const [activeTab, setActiveTab] = useState<'comments' | 'review'>('comments');
	const [newComment, setNewComment] = useState('');
	const [replyingTo, setReplyingTo] = useState<string | null>(null);
	const [replyText, setReplyText] = useState('');
	const [filterResolved, setFilterResolved] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedAuthorId, setSelectedAuthorId] = useState('all');
	const [threadSortMode, setThreadSortMode] = useState<
		'recent' | 'oldest' | 'open_first'
	>('recent');
	const [threadQueueMode, setThreadQueueMode] = useState<
		'all' | 'assigned_to_me' | 'unresolved_in_selection' | 'recently_changed'
	>('all');
	const [reviewStatus, setReviewStatus] = useState<ReviewStatus>('draft');
	const [bulkResolving, setBulkResolving] = useState(false);
	const [activeMentionTarget, setActiveMentionTarget] = useState<
		'comment' | 'reply' | null
	>(null);
	const [showHotkeysHelp, setShowHotkeysHelp] = useState(false);

	const newCommentInputRef = useRef<HTMLInputElement | null>(null);
	const replyInputRef = useRef<HTMLInputElement | null>(null);
	const commentsListScrollRef = useRef<HTMLDivElement>(null);

	const queries = useCommentsReviewQueries({ documentId, isOpen, t });

	const incomingSelection = useMemo<ThreadSelection | null>(() => {
		const text = selectedTextProp?.trim();
		if (!selectionRange || !text || selectionRange.from === selectionRange.to) {
			return null;
		}
		return {
			start: selectionRange.from,
			end: selectionRange.to,
			text,
		};
	}, [selectedTextProp, selectionRange]);

	const [composerSelection, setComposerSelection] =
		useState<ThreadSelection | null>(incomingSelection);

	const authorOptions = useMemo(
		() => buildAuthorOptions(queries.threads),
		[queries.threads]
	);

	useEffect(() => {
		if (selectedAuthorId === 'all') {
			return;
		}
		if (!authorOptions.some((author) => author.id === selectedAuthorId)) {
			setSelectedAuthorId('all');
		}
	}, [authorOptions, selectedAuthorId]);

	const filteredComments = useMemo(
		() =>
			filterCommentThreads({
				threads: queries.threads,
				filterResolved,
				selectedAuthorId,
				threadQueueMode,
				searchQuery,
				currentUserId: currentUser.id,
				incomingSelection,
			}),
		[
			currentUser.id,
			filterResolved,
			incomingSelection,
			queries.threads,
			searchQuery,
			selectedAuthorId,
			threadQueueMode,
		]
	);

	const sortedComments = useMemo(
		() => sortCommentThreads(filteredComments, threadSortMode),
		[filteredComments, threadSortMode]
	);

	const { unresolvedVisibleThreadIds, resolvedVisibleThreadIds } = useMemo(
		() => partitionVisibleThreadIds(sortedComments),
		[sortedComments]
	);

	const mutations = useCommentsReviewMutations({
		documentId,
		t,
		notify: { success, error: showError },
		threads: queries.threads,
		setThreads: queries.setThreads,
		currentUser,
		canWriteComments: queries.canWriteComments,
		canManageThreads: queries.canManageThreads,
		canResolveThreads: queries.canResolveThreads,
		canAssignReviewer: queries.canAssignReviewer,
		canUpdateReviewStatus: queries.canUpdateReviewStatus,
		capabilitiesKnown: queries.capabilitiesKnown,
		composerSelection,
		setComposerSelection,
		newComment,
		setNewComment,
		replyingTo,
		setReplyingTo,
		replyText,
		setReplyText,
		setActiveMentionTarget,
		bulkResolving,
		setBulkResolving,
		unresolvedVisibleThreadIds,
		resolvedVisibleThreadIds,
		reviewStatus,
		setReviewStatus,
	});

	const { flashFocusedThreadId } = useCommentsReviewSelectionEffects({
		isOpen,
		activeTab,
		threads: queries.threads,
		onThreadsChange,
		focusedThreadId,
		onFocusThread,
		incomingSelection,
		composerSelection,
		setComposerSelection,
		externalThreadAction,
		onExternalThreadActionHandled,
		handleResolveComment: mutations.handleResolveComment,
		handleMarkThreadRead: mutations.handleMarkThreadRead,
		setActiveTab,
		setReplyingTo,
		setReplyText,
	});

	const mentions = useCommentMentions({
		currentUser,
		authorOptions,
		activeMentionTarget,
		newComment,
		replyText,
		setNewComment,
		setReplyText,
		setActiveMentionTarget,
	});

	const focusNextActionableThread = (): void => {
		const nextThreadId = getNextActionableThreadId(
			sortedComments,
			focusedThreadId,
			currentUser.id
		);
		if (nextThreadId) {
			onFocusThread?.(nextThreadId);
		}
	};

	useCommentsReviewHotkeys({
		isOpen,
		activeTab,
		sortedComments,
		focusedThreadId,
		onFocusThread,
		replyingTo,
		newCommentInputRef,
		replyInputRef,
		handleResolveComment: mutations.handleResolveComment,
		handleReopenComment: mutations.handleReopenComment,
		focusNextActionableThread,
	});

	const commentsListScrollRect = useResizeObserverRect(
		commentsListScrollRef,
		isOpen && activeTab === 'comments'
	);

	const commentsListHeight = useMemo(() => {
		const h = commentsListScrollRect.height;
		if (h < 80) {
			return 360;
		}
		return Math.min(720, Math.max(240, Math.round(h)));
	}, [commentsListScrollRect.height]);

	const reviewStatuses = useMemo(
		() =>
			REVIEW_STATUS_UI.map((row) => ({
				...row,
				label: t(`comments.reviewStatus.${row.value}`),
			})),
		[t]
	);

	const formatTime = useMemo(() => createFormatCommentRelativeTime(t), [t]);

	const reviewerOptions = useMemo(() => {
		const map = new Map<string, string>();
		map.set(currentUser.id, currentUser.name);
		authorOptions.forEach((author) => {
			map.set(author.id, author.name);
		});
		queries.threads.forEach((thread) => {
			if (thread.assignedReviewer) {
				map.set(thread.assignedReviewer.id, thread.assignedReviewer.name);
			}
		});
		return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
	}, [authorOptions, currentUser.id, currentUser.name, queries.threads]);

	const unresolvedCount = useMemo(
		() => countUnresolvedThreads(queries.threads),
		[queries.threads]
	);

	return {
		t,
		docSidePanelZ,
		activeTab,
		setActiveTab,
		showHotkeysHelp,
		setShowHotkeysHelp,
		searchQuery,
		setSearchQuery,
		threadQueueMode,
		setThreadQueueMode,
		selectedAuthorId,
		setSelectedAuthorId,
		filterResolved,
		setFilterResolved,
		threadSortMode,
		setThreadSortMode,
		composerSelection,
		setComposerSelection,
		newComment,
		setNewComment,
		replyingTo,
		setReplyingTo,
		replyText,
		setReplyText,
		activeMentionTarget,
		setActiveMentionTarget,
		newCommentInputRef,
		replyInputRef,
		commentsListScrollRef,
		commentsListHeight,
		...queries,
		...mutations,
		flashFocusedThreadId,
		authorOptions,
		sortedComments,
		unresolvedVisibleThreadIds,
		resolvedVisibleThreadIds,
		unresolvedCount,
		reviewStatuses,
		reviewStatus,
		formatTime,
		reviewerOptions,
		mentionSuggestions: mentions.mentionSuggestions,
		threadMentionSuggestions: mentions.threadMentionSuggestions,
		applyMentionSuggestion: mentions.applyMentionSuggestion,
		focusNextActionableThread,
		onJumpToSelection,
		onFocusThread,
		currentUser,
		bulkResolving,
	};
}

export type CommentsReviewCompose = ReturnType<typeof useCommentsReviewCompose>;
