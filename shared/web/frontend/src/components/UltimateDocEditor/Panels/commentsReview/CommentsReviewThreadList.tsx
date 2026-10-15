/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Virtualized or static thread list rendering for CommentsReviewPanel.
 *
 * Related:
 * - CommentsReviewThreadCard.tsx, VirtualVariableList
 */

import * as React from 'react';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import type { RefObject } from 'react';

import { VirtualVariableList } from '@/components/shared/VirtualList';
import {
	COMMENT_THREAD_VIRTUAL_MIN,
	ESTIMATE_THREAD_BASE_PX,
	ESTIMATE_THREAD_COMMENT_PX,
	ESTIMATE_THREAD_REPLY_OPEN_PX,
	ESTIMATE_THREAD_SELECTION_PX,
} from '@/components/UltimateDocEditor/Panels/commentsReview/commentsReviewConstants';
import {
	CommentsReviewThreadCard,
	type CommentsReviewThreadCardProps,
} from '@/components/UltimateDocEditor/Panels/commentsReview/CommentsReviewThreadCard';
import type { CommentThread } from '@/components/UltimateDocEditor/types/editor.types';
import {
	DesktopAppEmptyState,
	DesktopAppPanel,
} from '@/pages/Desktop/components/DesktopAppChrome';

export interface CommentsReviewThreadListProps {
	t: TFunction;
	sortedComments: CommentThread[];
	commentsError: string | null;
	searchQuery: string;
	commentsListScrollRef: RefObject<HTMLDivElement | null>;
	commentsListHeight: number;
	replyingTo: string | null;
	renderThreadCardProps: Omit<
		CommentsReviewThreadCardProps,
		'thread' | 'animateEntry'
	>;
}

export function CommentsReviewThreadList({
	t,
	sortedComments,
	commentsError,
	searchQuery,
	commentsListScrollRef,
	commentsListHeight,
	replyingTo,
	renderThreadCardProps,
}: CommentsReviewThreadListProps) {
	const estimateCommentThreadHeight = React.useCallback(
		(index: number) => {
			const thread = sortedComments[index];
			if (!thread) {
				return ESTIMATE_THREAD_BASE_PX;
			}
			let h =
				ESTIMATE_THREAD_BASE_PX +
				thread.comments.length * ESTIMATE_THREAD_COMMENT_PX;
			if (thread.selection) {
				h += ESTIMATE_THREAD_SELECTION_PX;
			}
			if (replyingTo === thread.id) {
				h += ESTIMATE_THREAD_REPLY_OPEN_PX;
			}
			return h;
		},
		[sortedComments, replyingTo]
	);

	const renderCommentThreadCard = React.useCallback(
		(thread: CommentThread, animateEntry = true) => (
			<CommentsReviewThreadCard
				thread={thread}
				animateEntry={animateEntry}
				{...renderThreadCardProps}
			/>
		),
		[renderThreadCardProps]
	);

	const renderVirtualCommentThread = React.useCallback(
		(thread: CommentThread) => (
			<div className="pb-4">{renderCommentThreadCard(thread, false)}</div>
		),
		[renderCommentThreadCard]
	);

	return (
		<div
			ref={commentsListScrollRef}
			className="min-h-0 flex-1 bg-(--desktop-surface-app) [-webkit-overflow-scrolling:touch]"
		>
			{sortedComments.length === 0 ? (
				<DesktopAppPanel className="m-4 border-dashed bg-transparent">
					<DesktopAppEmptyState
						icon={
							<ChatBubbleLeftRightIcon
								width={48}
								height={48}
								className="mx-auto text-white/30"
							/>
						}
						title={
							commentsError
								? t('comments.loadErrorTitle')
								: searchQuery
									? t('comments.empty.noneFoundTitle')
									: t('comments.empty.noCommentsTitle')
						}
						description={
							commentsError
								? t('comments.emptyWithError')
								: searchQuery
									? t('comments.empty.noneFoundDesc')
									: t('comments.empty.noCommentsDesc')
						}
						className="py-12"
					/>
				</DesktopAppPanel>
			) : sortedComments.length >= COMMENT_THREAD_VIRTUAL_MIN ? (
				<VirtualVariableList
					items={sortedComments}
					estimateSize={estimateCommentThreadHeight}
					height={commentsListHeight}
					overscanCount={4}
					className="px-4 pt-4"
					renderItem={renderVirtualCommentThread}
				/>
			) : (
				<div className="space-y-4 overflow-y-auto overscroll-contain p-4">
					{sortedComments.map((thread) => (
						<React.Fragment key={thread.id}>
							{renderCommentThreadCard(thread)}
						</React.Fragment>
					))}
				</div>
			)}
		</div>
	);
}
