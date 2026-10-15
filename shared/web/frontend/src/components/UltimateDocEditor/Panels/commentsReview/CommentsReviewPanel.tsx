/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Comments & review side panel shell; delegates state and mutations to commentsReview/* modules.
 *
 * Invariants:
 * - Dual thread state: panel threads → onThreadsChange → session → TipTap anchors.
 * - API capabilities win; permissionRole is display-only.
 * - External action token handshake preserved via useCommentsReviewSelectionEffects.
 *
 * Related:
 * - ../CommentsReviewPanel.tsx (facade re-export)
 * - chrome/UltimateDocEditorPanelOverlays.tsx
 */

import * as React from 'react';
import { motion } from 'framer-motion';

import { CommentsReviewComposer } from '@/components/UltimateDocEditor/Panels/commentsReview/CommentsReviewComposer';
import { CommentsReviewFiltersBar } from '@/components/UltimateDocEditor/Panels/commentsReview/CommentsReviewFiltersBar';
import { CommentsReviewPanelHeader } from '@/components/UltimateDocEditor/Panels/commentsReview/CommentsReviewPanelHeader';
import { CommentsReviewReviewTab } from '@/components/UltimateDocEditor/Panels/commentsReview/CommentsReviewReviewTab';
import { CommentsReviewThreadList } from '@/components/UltimateDocEditor/Panels/commentsReview/CommentsReviewThreadList';
import type { CommentsReviewPanelProps } from '@/components/UltimateDocEditor/Panels/commentsReview/commentsReviewTypes';
import { useCommentsReviewCompose } from '@/components/UltimateDocEditor/Panels/commentsReview/useCommentsReviewCompose';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

export const CommentsReviewPanel: React.FC<CommentsReviewPanelProps> = (
	props
) => {
	const { isOpen, onClose, documentId, permissionRole = 'owner' } = props;

	const c = useCommentsReviewCompose(props);

	if (!isOpen) {
		return null;
	}

	return (
		<motion.div
			role="dialog"
			aria-modal="true"
			aria-labelledby="comments-review-panel-title"
			initial={{ opacity: 0, x: 100 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: 100 }}
			transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] as const }}
			className="comments-review-panel fixed bottom-0 right-0 top-0 flex min-h-0 w-[450px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden border-l border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong) shadow-(--desktop-shadow-panel) backdrop-blur-2xl"
			style={{ zIndex: c.docSidePanelZ }}
		>
			<CommentsReviewPanelHeader
				t={c.t}
				commentsLoading={c.commentsLoading}
				unresolvedCount={c.unresolvedCount}
				totalThreads={c.threads.length}
				commentsError={c.commentsError}
				documentId={documentId}
				capabilitiesKnown={c.capabilitiesKnown}
				permissionRole={permissionRole}
				showHotkeysHelp={c.showHotkeysHelp}
				onToggleHotkeysHelp={() => c.setShowHotkeysHelp((prev) => !prev)}
				onClose={onClose}
			/>

			<div className="flex shrink-0 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 pt-3">
				<button
					type="button"
					onClick={() => c.setActiveTab('comments')}
					className={`flex-1 rounded-t-xl px-4 py-3 text-sm font-medium transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] ${
						c.activeTab === 'comments'
							? 'border border-b-transparent border-blue-400/30 bg-blue-500/10 text-blue-300'
							: 'text-(--desktop-text-muted) hover:text-(--desktop-text-primary)'
					}`}
				>
					{c.t('comments.tabs.comments', { count: c.unresolvedCount })}
				</button>
				<button
					type="button"
					onClick={() => c.setActiveTab('review')}
					className={`flex-1 rounded-t-xl px-4 py-3 text-sm font-medium transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] ${
						c.activeTab === 'review'
							? 'border border-b-transparent border-purple-400/30 bg-purple-500/10 text-purple-300'
							: 'text-(--desktop-text-muted) hover:text-(--desktop-text-primary)'
					}`}
				>
					{c.t('comments.tabs.review')}
				</button>
			</div>

			{c.activeTab === 'comments' ? (
				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
					{c.commentsError && (
						<div
							className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-3"
							role="alert"
						>
							<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
								<div className="text-xs text-amber-100">
									<p className="font-medium text-amber-50">
										{c.t('comments.loadErrorTitle')}
									</p>
									<p className="mt-1 text-amber-100/90">{c.commentsError}</p>
									<p className="mt-1 text-[11px] text-amber-200/85">
										{c.t('comments.loadErrorHint')}
									</p>
								</div>
								<DesktopAppButton
									size="sm"
									variant="ghost"
									onClick={() => void c.loadThreads()}
									className="min-h-10 shrink-0 border border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
								>
									{c.t('comments.retry')}
								</DesktopAppButton>
							</div>
						</div>
					)}

					<CommentsReviewFiltersBar
						t={c.t}
						searchQuery={c.searchQuery}
						onSearchQueryChange={c.setSearchQuery}
						threadQueueMode={c.threadQueueMode}
						onThreadQueueModeChange={c.setThreadQueueMode}
						selectedAuthorId={c.selectedAuthorId}
						onSelectedAuthorIdChange={c.setSelectedAuthorId}
						authorOptions={c.authorOptions}
						filterResolved={c.filterResolved}
						onFilterResolvedToggle={() => c.setFilterResolved((v) => !v)}
						threadSortMode={c.threadSortMode}
						onThreadSortModeChange={c.setThreadSortMode}
						canManageThreads={c.canManageThreads}
						bulkResolving={c.bulkResolving}
						unresolvedVisibleCount={c.unresolvedVisibleThreadIds.length}
						resolvedVisibleCount={c.resolvedVisibleThreadIds.length}
						showHotkeysHelp={c.showHotkeysHelp}
						onFocusNextActionable={c.focusNextActionableThread}
						onResolveVisible={() => void c.handleResolveVisibleThreads()}
						onReopenVisible={c.handleReopenVisibleThreads}
					/>

					<CommentsReviewComposer
						t={c.t}
						composerSelection={c.composerSelection}
						onClearComposerSelection={() => c.setComposerSelection(null)}
						onJumpToSelection={c.onJumpToSelection}
						onFocusThread={c.onFocusThread}
						newComment={c.newComment}
						onNewCommentChange={c.setNewComment}
						onNewCommentFocusMention={() => c.setActiveMentionTarget('comment')}
						onSubmit={() => void c.handleAddComment()}
						canWriteComments={c.canWriteComments}
						newCommentInputRef={c.newCommentInputRef}
						activeMentionTarget={c.activeMentionTarget}
						mentionSuggestions={c.mentionSuggestions}
						onApplyMentionSuggestion={c.applyMentionSuggestion}
					/>

					<CommentsReviewThreadList
						t={c.t}
						sortedComments={c.sortedComments}
						commentsError={c.commentsError}
						searchQuery={c.searchQuery}
						commentsListScrollRef={c.commentsListScrollRef}
						commentsListHeight={c.commentsListHeight}
						replyingTo={c.replyingTo}
						renderThreadCardProps={{
							t: c.t,
							flashFocusedThreadId: c.flashFocusedThreadId,
							canManageThreads: c.canManageThreads,
							canWriteComments: c.canWriteComments,
							currentUserId: c.currentUser.id,
							reviewerOptions: c.reviewerOptions,
							replyingTo: c.replyingTo,
							replyText: c.replyText,
							activeMentionTarget: c.activeMentionTarget,
							mentionSuggestions: c.threadMentionSuggestions,
							replyInputRef: c.replyInputRef,
							onTogglePinThread: c.handleTogglePinThread,
							onToggleFollowThread: c.handleToggleFollowThread,
							onAssignThreadReviewer: c.handleAssignThreadReviewer,
							onJumpToSelection: c.onJumpToSelection,
							onFocusThread: c.onFocusThread,
							onResolveComment: c.handleResolveComment,
							onReopenComment: c.handleReopenComment,
							onReply: c.handleReply,
							onSubmitReply: () => void c.handleSubmitReply(),
							setReplyText: c.setReplyText,
							setReplyingTo: c.setReplyingTo,
							setActiveMentionTarget: c.setActiveMentionTarget,
							applyMentionSuggestion: (candidate) =>
								c.applyMentionSuggestion({
									id: candidate.handle,
									name: candidate.label,
									handle: candidate.handle,
								}),
							formatTime: c.formatTime,
						}}
					/>
				</div>
			) : (
				<CommentsReviewReviewTab
					t={c.t}
					reviewStatuses={c.reviewStatuses}
					reviewStatus={c.reviewStatus}
					canUpdateReviewStatus={c.canUpdateReviewStatus}
					onUpdateReviewStatus={c.handleUpdateReviewStatus}
					threads={c.threads}
					unresolvedCount={c.unresolvedCount}
				/>
			)}
		</motion.div>
	);
};
