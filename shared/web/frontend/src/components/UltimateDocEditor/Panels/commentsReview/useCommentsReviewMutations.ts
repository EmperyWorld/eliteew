/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Comment thread mutations: create, reply, resolve/reopen, pin/follow, assign, bulk ops, review tab.
 *
 * Invariants:
 * - Mutations respect API capabilities; permissionRole is never used for gating.
 *
 * Related:
 * - useCommentsReviewQueries.ts, docEditorCommentsApi.ts
 */

import { useCallback } from 'react';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';

import {
	addCommentToThread,
	assignCommentThreadReviewer,
	createCommentThread,
	followCommentThread,
	markCommentThreadRead,
	pinCommentThread,
	reopenCommentThreadsBulk,
	resolveCommentThread,
	resolveCommentThreadsBulk,
	unfollowCommentThread,
	unpinCommentThread,
} from '@/components/UltimateDocEditor/api/docEditorCommentsApi';
import {
	mapAddedCommentToComment,
	mapApiThreadToCommentThread,
	normalizeCommentThreadSelection,
} from '@/components/UltimateDocEditor/Panels/commentsReview/mapCommentApi';
import type { ThreadSelection } from '@/components/UltimateDocEditor/Panels/commentsReview/commentsReviewTypes';
import type {
	CommentThread,
	ReviewStatus,
} from '@/components/UltimateDocEditor/types/editor.types';

export interface CommentsReviewNotify {
	success: (title: string, description?: string) => void;
	error: (title: string, description?: string) => void;
}

export interface UseCommentsReviewMutationsParams {
	documentId: string | undefined;
	t: TFunction;
	notify: CommentsReviewNotify;
	threads: CommentThread[];
	setThreads: Dispatch<SetStateAction<CommentThread[]>>;
	currentUser: { id: string; name: string; avatar?: string };
	canWriteComments: boolean;
	canManageThreads: boolean;
	canResolveThreads: boolean;
	canAssignReviewer: boolean;
	canUpdateReviewStatus: boolean;
	capabilitiesKnown: boolean;
	composerSelection: ThreadSelection | null;
	setComposerSelection: (value: ThreadSelection | null) => void;
	newComment: string;
	setNewComment: (value: string) => void;
	replyingTo: string | null;
	setReplyingTo: (value: string | null) => void;
	replyText: string;
	setReplyText: (value: string) => void;
	setActiveMentionTarget: (value: 'comment' | 'reply' | null) => void;
	bulkResolving: boolean;
	setBulkResolving: (value: boolean) => void;
	unresolvedVisibleThreadIds: string[];
	resolvedVisibleThreadIds: string[];
	reviewStatus: ReviewStatus;
	setReviewStatus: (value: ReviewStatus) => void;
}

export function useCommentsReviewMutations({
	documentId,
	t,
	notify,
	threads: _threads,
	setThreads,
	currentUser,
	canWriteComments,
	canManageThreads,
	canResolveThreads,
	canAssignReviewer,
	canUpdateReviewStatus,
	capabilitiesKnown,
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
	reviewStatus: _reviewStatus,
	setReviewStatus,
}: UseCommentsReviewMutationsParams) {
	const { success, error: showError } = notify;

	const handleAddComment = useCallback(async () => {
		if (!canWriteComments) {
			showError(
				t('comments.errors.insufficientRightsTitle'),
				capabilitiesKnown
					? t('comments.errors.noCommentWriteBody')
					: t('comments.errors.capabilitiesUnavailableBody')
			);
			return;
		}
		const trimmedComment = newComment.trim();
		if (!trimmedComment) return;

		const nextSelection = composerSelection
			? { ...composerSelection }
			: undefined;

		if (!documentId) {
			showError(
				t('comments.errors.cannotCreateThreadTitle'),
				t('comments.errors.saveDocumentFirstBody')
			);
			return;
		}
		try {
			const thread = await createCommentThread(documentId, nextSelection ?? {});
			const added = await addCommentToThread(
				documentId,
				thread.id,
				trimmedComment
			);
			const normalizedBase = mapApiThreadToCommentThread(thread);
			const selectionMerged =
				normalizeCommentThreadSelection(nextSelection ?? thread.selection) ??
				normalizedBase.selection;
			setThreads((prev) => [
				{
					...normalizedBase,
					...(selectionMerged !== undefined
						? { selection: selectionMerged }
						: {}),
					comments: [mapAddedCommentToComment(added, currentUser)],
				},
				...prev,
			]);
		} catch (e) {
			console.error('[CommentsReviewPanel] Create thread/comment failed', e);
			showError(
				t('comments.errors.createThreadFailedTitle'),
				t('comments.errors.tryAgainRefreshBody')
			);
			return;
		}

		setNewComment('');
		setReplyingTo(null);
		setComposerSelection(null);
		setActiveMentionTarget(null);
		success(
			nextSelection
				? t('comments.toasts.commentAddedSelectionTitle')
				: t('comments.toasts.commentAddedTitle'),
			nextSelection
				? t('comments.toasts.commentAddedSelectionDesc')
				: t('comments.toasts.commentAddedGeneralDesc')
		);
	}, [
		canWriteComments,
		capabilitiesKnown,
		composerSelection,
		currentUser,
		documentId,
		newComment,
		setActiveMentionTarget,
		setComposerSelection,
		setNewComment,
		setReplyingTo,
		setThreads,
		showError,
		success,
		t,
	]);

	const handleResolveComment = useCallback(
		async (threadId: string) => {
			if (!canResolveThreads) {
				showError(
					t('comments.errors.insufficientRightsTitle'),
					t('comments.errors.noResolveThreadsBody')
				);
				return;
			}
			if (!documentId) {
				showError(
					t('comments.errors.cannotResolveTitle'),
					t('comments.errors.saveDocumentFirstBody')
				);
				return;
			}
			try {
				await resolveCommentThread(documentId, threadId);
				setThreads((prev) =>
					prev.map((thread) =>
						thread.id === threadId
							? {
									...thread,
									comments: thread.comments.map((c) => ({
										...c,
										resolved: true,
									})),
								}
							: thread
					)
				);
			} catch (e) {
				console.error('[CommentsReviewPanel] Resolve thread failed', e);
				showError(
					t('comments.errors.resolveFailedTitle'),
					t('comments.errors.tryAgainBody')
				);
				return;
			}
			success(t('comments.toasts.threadResolved'));
		},
		[canResolveThreads, documentId, setThreads, showError, success, t]
	);

	const handleReopenComment = useCallback(
		async (threadId: string) => {
			if (!canResolveThreads) {
				showError(
					t('comments.errors.insufficientRightsTitle'),
					t('comments.errors.noReopenThreadsBody')
				);
				return;
			}
			if (!documentId) {
				showError(
					t('comments.errors.cannotReopenTitle'),
					t('comments.errors.saveDocumentFirstBody')
				);
				return;
			}
			try {
				const bulkResult = await reopenCommentThreadsBulk(documentId, [
					threadId,
				]);
				const succeeded = new Set(bulkResult.updatedThreadIds);
				if (!succeeded.has(threadId)) {
					showError(
						t('comments.errors.reopenFailedTitle'),
						t('comments.errors.tryAgainBody')
					);
					return;
				}
				setThreads((prev) =>
					prev.map((thread) =>
						thread.id === threadId
							? {
									...thread,
									comments: thread.comments.map((c) => ({
										...c,
										resolved: false,
									})),
								}
							: thread
					)
				);
				success(t('comments.toasts.threadReopened'));
			} catch (e) {
				console.error('[CommentsReviewPanel] Reopen thread failed', e);
				showError(
					t('comments.errors.reopenFailedTitle'),
					t('comments.errors.tryAgainBody')
				);
			}
		},
		[canResolveThreads, documentId, setThreads, showError, success, t]
	);

	const handleReply = useCallback(
		(threadId: string) => {
			if (!canWriteComments) {
				showError(
					t('comments.errors.insufficientRightsTitle'),
					t('comments.errors.noReplyThreadsBody')
				);
				return;
			}
			setReplyingTo(threadId);
			setReplyText('');
			setActiveMentionTarget(null);
		},
		[
			canWriteComments,
			setActiveMentionTarget,
			setReplyText,
			setReplyingTo,
			showError,
			t,
		]
	);

	const handleSubmitReply = useCallback(async () => {
		if (!canWriteComments) {
			showError(
				t('comments.errors.insufficientRightsTitle'),
				t('comments.errors.noReplyThreadsBody')
			);
			return;
		}
		const trimmedReply = replyText.trim();
		if (!trimmedReply || !replyingTo) return;

		if (!documentId) {
			showError(
				t('comments.errors.cannotAddReplyTitle'),
				t('comments.errors.saveDocumentFirstBody')
			);
			return;
		}
		try {
			const added = await addCommentToThread(
				documentId,
				replyingTo,
				trimmedReply
			);
			const newCommentRow = mapAddedCommentToComment(
				{ ...added, threadId: replyingTo },
				currentUser
			);
			setThreads((prev) =>
				prev.map((thread) =>
					thread.id === replyingTo
						? {
								...thread,
								comments: [...thread.comments, newCommentRow],
							}
						: thread
				)
			);
		} catch (e) {
			console.error('[CommentsReviewPanel] Add reply failed', e);
			showError(
				t('comments.errors.addReplyFailedTitle'),
				t('comments.errors.tryAgainBody')
			);
			return;
		}

		setReplyingTo(null);
		setReplyText('');
		setActiveMentionTarget(null);
		success(t('comments.toasts.replyAdded'));
	}, [
		canWriteComments,
		currentUser,
		documentId,
		replyText,
		replyingTo,
		setActiveMentionTarget,
		setReplyText,
		setReplyingTo,
		setThreads,
		showError,
		success,
		t,
	]);

	const handleTogglePinThread = useCallback(
		async (threadId: string, shouldPin: boolean): Promise<void> => {
			if (!documentId) {
				showError(
					t('comments.errors.cannotUpdateThreadTitle'),
					t('comments.errors.saveDocumentFirstBody')
				);
				return;
			}
			try {
				if (shouldPin) {
					await pinCommentThread(documentId, threadId);
				} else {
					await unpinCommentThread(documentId, threadId);
				}
				setThreads((prev) =>
					prev.map((thread) =>
						thread.id === threadId ? { ...thread, isPinned: shouldPin } : thread
					)
				);
			} catch {
				showError(
					t('comments.errors.pinUpdateFailedTitle'),
					t('comments.errors.tryAgainBody')
				);
			}
		},
		[documentId, setThreads, showError, t]
	);

	const handleToggleFollowThread = useCallback(
		async (threadId: string, shouldFollow: boolean): Promise<void> => {
			if (!documentId) {
				showError(
					t('comments.errors.cannotUpdateThreadTitle'),
					t('comments.errors.saveDocumentFirstBody')
				);
				return;
			}
			try {
				if (shouldFollow) {
					await followCommentThread(documentId, threadId);
				} else {
					await unfollowCommentThread(documentId, threadId);
				}
				setThreads((prev) =>
					prev.map((thread) =>
						thread.id === threadId
							? { ...thread, isFollowing: shouldFollow }
							: thread
					)
				);
			} catch {
				showError(
					t('comments.errors.followUpdateFailedTitle'),
					t('comments.errors.tryAgainBody')
				);
			}
		},
		[documentId, setThreads, showError, t]
	);

	const handleAssignThreadReviewer = useCallback(
		async (threadId: string, reviewerId: string): Promise<void> => {
			if (!canAssignReviewer) {
				showError(
					t('comments.errors.insufficientRightsTitle'),
					t('comments.errors.noAssignReviewersBody')
				);
				return;
			}
			if (!documentId) {
				showError(
					t('comments.errors.cannotAssignReviewerTitle'),
					t('comments.errors.saveDocumentFirstBody')
				);
				return;
			}
			const reviewerIdOrNull = reviewerId === 'none' ? null : reviewerId;
			try {
				const result = await assignCommentThreadReviewer(
					documentId,
					threadId,
					reviewerIdOrNull
				);
				setThreads((prev) =>
					prev.map((thread) =>
						thread.id === threadId
							? {
									...thread,
									assignedReviewer: result.assignedReviewer
										? {
												id: result.assignedReviewer.id,
												name: result.assignedReviewer.name,
												avatar: result.assignedReviewer.avatar ?? undefined,
											}
										: null,
								}
							: thread
					)
				);
			} catch {
				showError(
					t('comments.errors.assignReviewerFailedTitle'),
					t('comments.errors.assignReviewerCheckBody')
				);
			}
		},
		[canAssignReviewer, documentId, setThreads, showError, t]
	);

	const handleMarkThreadRead = useCallback(
		async (threadId: string): Promise<void> => {
			if (!documentId) {
				return;
			}
			try {
				await markCommentThreadRead(documentId, threadId);
				setThreads((prev) =>
					prev.map((thread) =>
						thread.id === threadId ? { ...thread, unread: false } : thread
					)
				);
			} catch {
				// Silent fallback: unread flag reconciled on next load.
			}
		},
		[documentId, setThreads]
	);

	const handleResolveVisibleThreads = useCallback(async (): Promise<void> => {
		if (!canManageThreads) {
			showError(
				t('comments.errors.insufficientRightsTitle'),
				t('comments.errors.viewerBulkBody')
			);
			return;
		}
		if (bulkResolving || unresolvedVisibleThreadIds.length === 0) {
			return;
		}

		setBulkResolving(true);
		try {
			if (!documentId) {
				showError(
					t('comments.errors.cannotBulkOpTitle'),
					t('comments.errors.saveDocumentFirstBody')
				);
				return;
			}
			const bulkResult = await resolveCommentThreadsBulk(
				documentId,
				unresolvedVisibleThreadIds
			);
			const succeeded = new Set(bulkResult.updatedThreadIds);
			const failed = bulkResult.failed;

			if (succeeded.size > 0) {
				setThreads((prev) =>
					prev.map((thread) =>
						succeeded.has(thread.id)
							? {
									...thread,
									comments: thread.comments.map((comment) => ({
										...comment,
										resolved: true,
									})),
								}
							: thread
					)
				);
			}

			if (failed > 0) {
				showError(
					t('comments.errors.bulkResolvePartialTitle'),
					t('comments.errors.bulkResolvePartialBody', {
						succeeded: succeeded.size,
						failed,
					})
				);
			} else {
				success(
					t('comments.toasts.bulkResolvedTitle'),
					t('comments.toasts.bulkResolvedBody', { count: succeeded.size })
				);
			}
		} finally {
			setBulkResolving(false);
		}
	}, [
		bulkResolving,
		canManageThreads,
		documentId,
		setBulkResolving,
		setThreads,
		showError,
		success,
		t,
		unresolvedVisibleThreadIds,
	]);

	const handleReopenVisibleThreads = useCallback((): void => {
		if (!canManageThreads) {
			showError(
				t('comments.errors.insufficientRightsTitle'),
				t('comments.errors.viewerBulkBody')
			);
			return;
		}
		if (bulkResolving || resolvedVisibleThreadIds.length === 0) {
			return;
		}

		setBulkResolving(true);
		const run = async (): Promise<void> => {
			try {
				if (!documentId) {
					showError(
						t('comments.errors.cannotBulkOpTitle'),
						t('comments.errors.saveDocumentFirstBody')
					);
					return;
				}
				const bulkResult = await reopenCommentThreadsBulk(
					documentId,
					resolvedVisibleThreadIds
				);
				const succeeded = new Set(bulkResult.updatedThreadIds);
				const failed = bulkResult.failed;

				if (succeeded.size > 0) {
					setThreads((prev) =>
						prev.map((thread) =>
							succeeded.has(thread.id)
								? {
										...thread,
										comments: thread.comments.map((comment) => ({
											...comment,
											resolved: false,
										})),
									}
								: thread
						)
					);
				}

				if (failed > 0) {
					showError(
						t('comments.errors.bulkReopenPartialTitle'),
						t('comments.errors.bulkResolvePartialBody', {
							succeeded: succeeded.size,
							failed,
						})
					);
				} else {
					success(
						t('comments.toasts.bulkReopenedTitle'),
						t('comments.toasts.bulkReopenedBody', { count: succeeded.size })
					);
				}
			} finally {
				setBulkResolving(false);
			}
		};
		void run();
	}, [
		bulkResolving,
		canManageThreads,
		documentId,
		resolvedVisibleThreadIds,
		setBulkResolving,
		setThreads,
		showError,
		success,
		t,
	]);

	const handleUpdateReviewStatus = useCallback(
		(status: ReviewStatus): void => {
			if (!canUpdateReviewStatus) {
				showError(
					t('comments.errors.insufficientRightsTitle'),
					t('comments.errors.viewerReviewStatusBody')
				);
				return;
			}
			setReviewStatus(status);
			success(
				t('comments.toasts.reviewStatusUpdated', {
					status: t(`comments.reviewStatus.${status}`),
				})
			);
		},
		[canUpdateReviewStatus, setReviewStatus, showError, success, t]
	);

	return {
		handleAddComment,
		handleResolveComment,
		handleReopenComment,
		handleReply,
		handleSubmitReply,
		handleTogglePinThread,
		handleToggleFollowThread,
		handleAssignThreadReviewer,
		handleMarkThreadRead,
		handleResolveVisibleThreads,
		handleReopenVisibleThreads,
		handleUpdateReviewStatus,
	};
}
