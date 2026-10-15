/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Карточка треда комментариев в панели review — вынесена для виртуализированного списка.
 *
 * Invariants:
 * - Один открытый reply на документ (`replyingTo`); ref инпута общий у родителя.
 *
 * Related:
 * - CommentsReviewPanel.tsx, VirtualVariableList
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import type { TFunction } from 'i18next';
import { Input } from '@/components/atoms/Input';
import { cn } from '@/utils/cn';
import type { CommentThread } from '@/components/UltimateDocEditor/types/editor.types';
import {
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
	DesktopAppButton,
	DesktopAppStatusBadge,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';
import {
	ArrowUturnLeftIcon,
	BellIcon,
	BellSlashIcon,
	CheckIcon,
	MapPinIcon,
	PaperAirplaneIcon,
	UserPlusIcon,
	XCircleIcon,
	XMarkIcon,
} from '@heroicons/react/24/outline';

import { DESKTOP_DOC_INPUT_CHROME } from '@/components/UltimateDocEditor/Panels/commentsReview/commentsReviewConstants';

type ThreadSelection = NonNullable<CommentThread['selection']>;

export type CommentReviewerOption = { id: string; name: string };

export type MentionCandidate = { handle: string; label: string };

export interface CommentsReviewThreadCardProps {
	thread: CommentThread;
	t: TFunction;
	flashFocusedThreadId: string | null;
	canManageThreads: boolean;
	canWriteComments: boolean;
	currentUserId: string;
	reviewerOptions: CommentReviewerOption[];
	replyingTo: string | null;
	replyText: string;
	activeMentionTarget: 'comment' | 'reply' | null;
	mentionSuggestions: MentionCandidate[];
	replyInputRef: React.RefObject<HTMLInputElement | null>;
	onTogglePinThread: (
		threadId: string,
		pinned: boolean
	) => void | Promise<void>;
	onToggleFollowThread: (
		threadId: string,
		following: boolean
	) => void | Promise<void>;
	onAssignThreadReviewer: (
		threadId: string,
		reviewerId: string
	) => void | Promise<void>;
	onJumpToSelection?: (selection: ThreadSelection) => void;
	onFocusThread?: (threadId: string | null) => void;
	onResolveComment: (threadId: string) => void | Promise<void>;
	onReopenComment: (threadId: string) => void | Promise<void>;
	onReply: (threadId: string) => void;
	onSubmitReply: () => void;
	setReplyText: (value: string) => void;
	setReplyingTo: (threadId: string | null) => void;
	setActiveMentionTarget: (target: 'comment' | 'reply' | null) => void;
	applyMentionSuggestion: (candidate: MentionCandidate) => void;
	formatTime: (date: Date) => string;
	animateEntry?: boolean;
}

export const CommentsReviewThreadCard = React.memo(
	function CommentsReviewThreadCard({
		thread,
		t,
		flashFocusedThreadId,
		canManageThreads,
		canWriteComments,
		currentUserId,
		reviewerOptions,
		replyingTo,
		replyText,
		activeMentionTarget,
		mentionSuggestions,
		replyInputRef,
		onTogglePinThread,
		onToggleFollowThread,
		onAssignThreadReviewer,
		onJumpToSelection,
		onFocusThread,
		onResolveComment,
		onReopenComment,
		onReply,
		onSubmitReply,
		setReplyText,
		setReplyingTo,
		setActiveMentionTarget,
		applyMentionSuggestion,
		formatTime,
		animateEntry = true,
	}: CommentsReviewThreadCardProps) {
		const Wrapper = animateEntry ? motion.div : 'div';
		const wrapperProps = animateEntry
			? {
					initial: { opacity: 0, y: 10 },
					animate: { opacity: 1, y: 0 },
				}
			: {};

		return (
			<Wrapper
				{...wrapperProps}
				data-thread-id={thread.id}
				className={`overflow-hidden rounded-xl border bg-(--desktop-surface-soft) transition-all ${
					flashFocusedThreadId === thread.id
						? 'border-[rgb(var(--desktop-accent-rgb))]/55 ring-2 ring-[rgb(var(--desktop-accent-rgb))]/35 shadow-[0_0_0_1px_rgba(var(--desktop-accent-rgb),0.28)]'
						: 'border-(--desktop-border-subtle)'
				}`}
			>
				<div className="flex flex-wrap items-center gap-2 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-panel) px-3 py-2">
					{thread.unread ? (
						<DesktopAppStatusBadge className="border-blue-400/30 bg-blue-500/20 text-blue-200">
							{t('comments.thread.newBadge')}
						</DesktopAppStatusBadge>
					) : null}
					{thread.isPinned ? (
						<DesktopAppStatusBadge className="border-amber-400/30 bg-amber-500/20 text-amber-200">
							{t('comments.thread.pinnedBadge')}
						</DesktopAppStatusBadge>
					) : null}
					{thread.assignedReviewer ? (
						<DesktopAppStatusBadge className="border-violet-400/30 bg-violet-500/20 text-violet-200">
							{t('comments.thread.reviewer', {
								name: thread.assignedReviewer.name,
							})}
						</DesktopAppStatusBadge>
					) : (
						<DesktopAppStatusBadge className="border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-muted)">
							{t('comments.thread.reviewerUnassigned')}
						</DesktopAppStatusBadge>
					)}
					<div className="ml-auto flex items-center gap-2">
						<DesktopAppButton
							onClick={() =>
								void onTogglePinThread(thread.id, !thread.isPinned)
							}
							variant="ghost"
							size="sm"
							title={
								thread.isPinned
									? t('comments.thread.pinRemoveTitle')
									: t('comments.thread.pinAddTitle')
							}
						>
							<MapPinIcon width={12} height={12} />
						</DesktopAppButton>
						<DesktopAppButton
							onClick={() =>
								void onToggleFollowThread(
									thread.id,
									!(thread.isFollowing ?? true)
								)
							}
							variant="ghost"
							size="sm"
							title={
								(thread.isFollowing ?? true)
									? t('comments.thread.unfollowTitle')
									: t('comments.thread.followTitle')
							}
						>
							{(thread.isFollowing ?? true) ? (
								<BellSlashIcon width={12} height={12} />
							) : (
								<BellIcon width={12} height={12} />
							)}
						</DesktopAppButton>
						<DesktopNativeSelect
							value={thread.assignedReviewer?.id ?? 'none'}
							onChange={(event) =>
								void onAssignThreadReviewer(thread.id, event.target.value)
							}
							className="min-h-8 max-w-56 text-xs"
							aria-label={t('comments.thread.assignReviewerAria')}
						>
							<option
								value="none"
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								{t('comments.thread.noReviewerOption')}
							</option>
							{reviewerOptions.map((reviewer) => (
								<option
									key={reviewer.id}
									value={reviewer.id}
									className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
								>
									{reviewer.name}
								</option>
							))}
						</DesktopNativeSelect>
					</div>
				</div>
				{thread.selection ? (
					<div className="border-b border-(--desktop-border-subtle) bg-blue-500/10 p-3">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<div className="mb-1 text-xs text-blue-200">
									{t('comments.thread.selectedTextInThread', {
										start: thread.selection.start,
										end: thread.selection.end,
									})}
								</div>
								<div className="line-clamp-2 text-sm italic text-(--desktop-text-primary)">
									"{thread.selection.text}"
								</div>
							</div>
							{onJumpToSelection ? (
								<DesktopAppButton
									onClick={() => {
										onFocusThread?.(thread.id);
										onJumpToSelection(thread.selection as ThreadSelection);
									}}
									variant="ghost"
									size="sm"
									className="shrink-0"
								>
									{t('comments.composer.jumpToFragment')}
								</DesktopAppButton>
							) : null}
						</div>
					</div>
				) : null}

				<div className="divide-y divide-(--desktop-border-subtle)">
					{thread.comments.map((comment, commentIdx) => (
						<div key={comment.id} className="p-3">
							<div
								className={`flex items-start gap-3 ${
									commentIdx > 0
										? 'ml-2 border-l-2 border-(--desktop-border-subtle) pl-3.5'
										: ''
								}`}
							>
								<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-blue-500/30 to-purple-500/30 text-sm font-medium text-white">
									{comment.author.avatar || comment.author.name.charAt(0)}
								</div>
								<div className="min-w-0 flex-1">
									<div className="mb-1 flex items-center gap-2">
										<span className="text-sm font-medium text-(--desktop-text-primary)">
											{comment.author.name}
										</span>
										<span className="text-xs text-(--desktop-text-dim)">
											{formatTime(comment.createdAt)}
										</span>
										{comment.resolved ? (
											<DesktopAppStatusBadge className="border-green-400/30 bg-green-500/20 text-green-200">
												{t('comments.thread.resolvedBadge')}
											</DesktopAppStatusBadge>
										) : null}
									</div>
									<div className="text-sm leading-relaxed text-(--desktop-text-primary)">
										{comment.content}
									</div>
									{comment.mentions.length > 0 ? (
										<div className="mt-2 flex flex-wrap gap-1">
											{comment.mentions.map((mention) => (
												<DesktopAppStatusBadge
													key={mention}
													className="border-blue-400/30 bg-blue-500/20 text-blue-200"
												>
													@{mention}
												</DesktopAppStatusBadge>
											))}
										</div>
									) : null}
								</div>
							</div>
						</div>
					))}
				</div>

				<div className="border-t border-(--desktop-border-subtle) bg-(--desktop-surface-panel) p-3">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex flex-wrap items-center gap-2">
							<DesktopAppButton
								onClick={() =>
									void onAssignThreadReviewer(thread.id, currentUserId)
								}
								variant="neutral"
								size="sm"
								disabled={!canManageThreads}
							>
								<UserPlusIcon width={12} height={12} className="mr-1 inline" />
								{t('comments.thread.assignMe')}
							</DesktopAppButton>
							<DesktopAppButton
								onClick={() => onReply(thread.id)}
								variant="neutral"
								size="sm"
								disabled={!canWriteComments}
							>
								<ArrowUturnLeftIcon
									width={12}
									height={12}
									className="mr-1 inline"
								/>
								{t('comments.thread.reply')}
							</DesktopAppButton>
						</div>
						<div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
							{!thread.comments.every((c) => c.resolved) ? (
								<DesktopAppButton
									onClick={() => void onResolveComment(thread.id)}
									variant="accent"
									size="sm"
									disabled={!canManageThreads}
									className="min-h-9"
								>
									<CheckIcon width={12} height={12} className="mr-1 inline" />
									{t('comments.thread.resolve')}
								</DesktopAppButton>
							) : (
								<DesktopAppButton
									onClick={() => void onReopenComment(thread.id)}
									variant="neutral"
									size="sm"
									disabled={!canManageThreads}
									className="min-h-9"
								>
									<XCircleIcon width={12} height={12} className="mr-1 inline" />
									{t('comments.thread.reopen')}
								</DesktopAppButton>
							)}
						</div>
					</div>

					{replyingTo === thread.id ? (
						<motion.div
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: 'auto' }}
							exit={{ opacity: 0, height: 0 }}
							className="mt-3 border-t border-(--desktop-border-subtle) pt-3"
						>
							<div className="flex-1">
								<div className="flex gap-2">
									<Input
										ref={replyInputRef}
										type="text"
										placeholder={t('comments.thread.replyPlaceholder')}
										value={replyText}
										onChange={(e) => {
											setReplyText(e.target.value);
											setActiveMentionTarget('reply');
										}}
										onKeyDown={(e) => {
											if (e.key === 'Enter' && !e.shiftKey) {
												e.preventDefault();
												onSubmitReply();
											}
										}}
										className={cn(
											DESKTOP_DOC_INPUT_CHROME,
											'flex-1 focus-visible:border-blue-400/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400/30'
										)}
										autoFocus
										disabled={!canWriteComments}
									/>
									<DesktopAppButton
										onClick={onSubmitReply}
										disabled={!canWriteComments || !replyText.trim()}
										variant="accent"
										size="icon"
									>
										<PaperAirplaneIcon width={14} height={14} />
									</DesktopAppButton>
									<DesktopAppButton
										onClick={() => {
											setReplyingTo(null);
											setActiveMentionTarget(null);
										}}
										variant="ghost"
										size="icon"
									>
										<XMarkIcon width={14} height={14} />
									</DesktopAppButton>
								</div>
								{activeMentionTarget === 'reply' &&
								mentionSuggestions.length > 0 ? (
									<div className="mt-2 flex flex-wrap gap-2 rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) p-2">
										{mentionSuggestions.map((candidate) => (
											<DesktopAppButton
												key={candidate.handle}
												onClick={() => applyMentionSuggestion(candidate)}
												variant="ghost"
												size="sm"
											>
												@{candidate.handle}
											</DesktopAppButton>
										))}
									</div>
								) : null}
							</div>
						</motion.div>
					) : null}
				</div>
			</Wrapper>
		);
	}
);
