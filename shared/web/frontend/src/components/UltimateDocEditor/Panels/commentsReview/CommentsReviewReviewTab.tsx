/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Review tab: local review status picker, summary stats, export placeholders.
 *
 * Invariants:
 * - Review status is client-local until API persistence lands (out of scope).
 *
 * Related:
 * - commentsReviewConstants.ts, useCommentsReviewMutations.ts
 */

import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';

import { REVIEW_STATUS_UI } from '@/components/UltimateDocEditor/Panels/commentsReview/commentsReviewConstants';
import type {
	CommentThread,
	ReviewStatus,
} from '@/components/UltimateDocEditor/types/editor.types';
import {
	DesktopAppButton,
	DesktopAppPanel,
} from '@/pages/Desktop/components/DesktopAppChrome';

export interface CommentsReviewReviewTabProps {
	t: TFunction;
	reviewStatuses: Array<{
		value: ReviewStatus;
		icon: (typeof REVIEW_STATUS_UI)[number]['icon'];
		activeClassName: string;
		label: string;
	}>;
	reviewStatus: ReviewStatus;
	canUpdateReviewStatus: boolean;
	onUpdateReviewStatus: (status: ReviewStatus) => void;
	threads: CommentThread[];
	unresolvedCount: number;
}

export function CommentsReviewReviewTab({
	t,
	reviewStatuses,
	reviewStatus,
	canUpdateReviewStatus,
	onUpdateReviewStatus,
	threads,
	unresolvedCount,
}: CommentsReviewReviewTabProps) {
	return (
		<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-(--desktop-surface-app) p-4 [-webkit-overflow-scrolling:touch]">
			<div className="space-y-6">
				<DesktopAppPanel className="p-4">
					<h4 className="mb-3 text-sm font-semibold text-(--desktop-text-primary)">
						{t('comments.reviewTab.statusHeading')}
					</h4>
					<div className="grid grid-cols-2 gap-3">
						{reviewStatuses.map((status) => {
							const Icon = status.icon;
							const isActive = reviewStatus === status.value;
							return (
								<button
									type="button"
									key={status.value}
									onClick={() => onUpdateReviewStatus(status.value)}
									disabled={!canUpdateReviewStatus}
									className={`rounded-lg border p-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] ${
										isActive
											? status.activeClassName
											: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-muted) hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)'
									}`}
								>
									<Icon width={16} height={16} className="mb-2" />
									<div className="text-xs font-medium">{status.label}</div>
								</button>
							);
						})}
					</div>
				</DesktopAppPanel>

				<DesktopAppPanel className="p-4">
					<h4 className="mb-3 text-sm font-semibold text-(--desktop-text-primary)">
						{t('comments.reviewTab.summaryHeading')}
					</h4>
					<div className="space-y-2 text-sm">
						<div className="flex justify-between">
							<span className="text-(--desktop-text-secondary)">
								{t('comments.reviewTab.totalComments')}
							</span>
							<span className="text-(--desktop-text-primary)">
								{threads.reduce((sum, th) => sum + th.comments.length, 0)}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-(--desktop-text-secondary)">
								{t('comments.reviewTab.resolved')}
							</span>
							<span className="text-green-300">
								{threads.reduce(
									(sum, th) =>
										sum + th.comments.filter((c) => c.resolved).length,
									0
								)}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-(--desktop-text-secondary)">
								{t('comments.reviewTab.unresolved')}
							</span>
							<span className="text-orange-300">{unresolvedCount}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-(--desktop-text-secondary)">
								{t('comments.reviewTab.reviewers')}
							</span>
							<span className="text-(--desktop-text-primary)">
								{
									new Set(
										threads.flatMap((th) => th.comments.map((c) => c.author.id))
									).size
								}
							</span>
						</div>
					</div>
				</DesktopAppPanel>

				<DesktopAppPanel className="p-4">
					<h4 className="mb-3 text-sm font-semibold text-(--desktop-text-primary)">
						{t('comments.reviewTab.exportHeading')}
					</h4>
					<div className="space-y-2">
						<DesktopAppButton
							className="w-full justify-center"
							variant="neutral"
							disabled
							title={t('comments.reviewTab.comingSoonTitle')}
						>
							<ArrowDownTrayIcon
								width={14}
								height={14}
								className="inline mr-2"
							/>
							{t('comments.reviewTab.exportPdf')}
						</DesktopAppButton>
						<DesktopAppButton
							className="w-full justify-center"
							variant="accent"
							disabled
							title={t('comments.reviewTab.comingSoonTitle')}
						>
							<ArrowDownTrayIcon
								width={14}
								height={14}
								className="inline mr-2"
							/>
							{t('comments.reviewTab.exportReport')}
						</DesktopAppButton>
					</div>
				</DesktopAppPanel>
			</div>
		</div>
	);
}
