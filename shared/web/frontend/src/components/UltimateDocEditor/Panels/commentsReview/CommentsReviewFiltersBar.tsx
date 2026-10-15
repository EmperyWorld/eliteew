/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Filters, queue/sort controls, bulk actions, and hotkeys hint for comment threads.
 *
 * Related:
 * - filterSortCommentThreads.ts, CommentsReviewPanel.tsx
 */

import {
	CheckIcon,
	ChevronDoubleRightIcon,
	EyeIcon,
	EyeSlashIcon,
	MagnifyingGlassIcon,
	XCircleIcon,
} from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';

import {
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
	DesktopAppButton,
	DesktopAppInput,
	DesktopNativeSelect,
} from '@/pages/Desktop/components/DesktopAppChrome';
import type {
	CommentAuthorOption,
	ThreadQueueMode,
	ThreadSortMode,
} from '@/components/UltimateDocEditor/Panels/commentsReview/commentsReviewTypes';

export interface CommentsReviewFiltersBarProps {
	t: TFunction;
	searchQuery: string;
	onSearchQueryChange: (value: string) => void;
	threadQueueMode: ThreadQueueMode;
	onThreadQueueModeChange: (mode: ThreadQueueMode) => void;
	selectedAuthorId: string;
	onSelectedAuthorIdChange: (authorId: string) => void;
	authorOptions: CommentAuthorOption[];
	filterResolved: boolean;
	onFilterResolvedToggle: () => void;
	threadSortMode: ThreadSortMode;
	onThreadSortModeChange: (mode: ThreadSortMode) => void;
	canManageThreads: boolean;
	bulkResolving: boolean;
	unresolvedVisibleCount: number;
	resolvedVisibleCount: number;
	showHotkeysHelp: boolean;
	onFocusNextActionable: () => void;
	onResolveVisible: () => void;
	onReopenVisible: () => void;
}

export function CommentsReviewFiltersBar({
	t,
	searchQuery,
	onSearchQueryChange,
	threadQueueMode,
	onThreadQueueModeChange,
	selectedAuthorId,
	onSelectedAuthorIdChange,
	authorOptions,
	filterResolved,
	onFilterResolvedToggle,
	threadSortMode,
	onThreadSortModeChange,
	canManageThreads,
	bulkResolving,
	unresolvedVisibleCount,
	resolvedVisibleCount,
	showHotkeysHelp,
	onFocusNextActionable,
	onResolveVisible,
	onReopenVisible,
}: CommentsReviewFiltersBarProps) {
	return (
		<div className="border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4">
			<div className="flex flex-wrap items-start gap-2">
				<div className="relative min-w-[220px] grow">
					<MagnifyingGlassIcon
						width={16}
						height={16}
						className="absolute left-3 top-1/2 -translate-y-1/2 text-(--desktop-text-dim)"
					/>
					<DesktopAppInput
						type="text"
						placeholder={t('comments.filters.searchPlaceholder')}
						value={searchQuery}
						onChange={(e) => onSearchQueryChange(e.target.value)}
						className="w-full pl-10 focus-visible:border-blue-400/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400/30"
					/>
				</div>
				<div className="w-full min-w-[150px] sm:w-auto sm:min-w-[168px]">
					<DesktopNativeSelect
						value={threadQueueMode}
						onChange={(event) =>
							onThreadQueueModeChange(event.target.value as ThreadQueueMode)
						}
						className="min-h-9 text-xs"
						aria-label={t('comments.filters.queueAria')}
					>
						<option
							value="all"
							className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
						>
							{t('comments.filters.queueAll')}
						</option>
						<option
							value="assigned_to_me"
							className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
						>
							{t('comments.filters.queueAssignedToMe')}
						</option>
						<option
							value="unresolved_in_selection"
							className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
						>
							{t('comments.filters.queueUnresolvedInSelection')}
						</option>
						<option
							value="recently_changed"
							className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
						>
							{t('comments.filters.queueRecentlyChanged')}
						</option>
					</DesktopNativeSelect>
				</div>
				<div className="w-full min-w-[150px] sm:w-auto sm:min-w-[168px]">
					<DesktopNativeSelect
						value={selectedAuthorId}
						onChange={(event) => onSelectedAuthorIdChange(event.target.value)}
						className="min-h-9 text-xs"
						aria-label={t('comments.filters.authorFilterAria')}
					>
						<option
							value="all"
							className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
						>
							{t('comments.filters.allAuthors')}
						</option>
						{authorOptions.map((author) => (
							<option
								key={author.id}
								value={author.id}
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							>
								{author.name}
							</option>
						))}
					</DesktopNativeSelect>
				</div>
				<DesktopAppButton
					onClick={onFilterResolvedToggle}
					variant={filterResolved ? 'accent' : 'ghost'}
					size="icon"
					title={
						filterResolved
							? t('comments.filters.showAllCommentsTitle')
							: t('comments.filters.hideResolvedTitle')
					}
					aria-label={
						filterResolved
							? t('comments.filters.showAllCommentsTitle')
							: t('comments.filters.hideResolvedTitle')
					}
					aria-pressed={filterResolved}
				>
					{filterResolved ? (
						<EyeIcon width={16} height={16} />
					) : (
						<EyeSlashIcon width={16} height={16} />
					)}
				</DesktopAppButton>
				<div className="w-full min-w-[152px] sm:w-auto">
					<DesktopNativeSelect
						value={threadSortMode}
						onChange={(event) =>
							onThreadSortModeChange(event.target.value as ThreadSortMode)
						}
						className="min-h-9 text-xs"
						aria-label={t('comments.filters.sortAria')}
					>
						<option
							value="recent"
							className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
						>
							{t('comments.filters.sortRecent')}
						</option>
						<option
							value="oldest"
							className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
						>
							{t('comments.filters.sortOldest')}
						</option>
						<option
							value="open_first"
							className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
						>
							{t('comments.filters.sortOpenFirst')}
						</option>
					</DesktopNativeSelect>
				</div>
			</div>
			<div className="mt-2 flex flex-wrap items-center gap-2">
				<DesktopAppButton
					onClick={onFocusNextActionable}
					variant="neutral"
					size="sm"
					title={t('comments.bulk.nextActionableTitle')}
				>
					<ChevronDoubleRightIcon width={14} height={14} className="mr-1.5" />
					{t('comments.bulk.nextActionable')}
				</DesktopAppButton>
				<DesktopAppButton
					onClick={onResolveVisible}
					variant="neutral"
					size="sm"
					disabled={
						!canManageThreads || bulkResolving || unresolvedVisibleCount === 0
					}
					title={
						!canManageThreads
							? t('comments.bulk.noPermissionTitle')
							: unresolvedVisibleCount === 0
								? t('comments.bulk.noOpenThreadsTitle')
								: t('comments.bulk.resolveVisibleTitle', {
										count: unresolvedVisibleCount,
									})
					}
				>
					<CheckIcon width={14} height={14} className="mr-1.5" />
					{bulkResolving
						? t('comments.bulk.resolving')
						: t('comments.bulk.resolveAll', {
								count: unresolvedVisibleCount,
							})}
				</DesktopAppButton>
				<DesktopAppButton
					onClick={onReopenVisible}
					variant="neutral"
					size="sm"
					disabled={
						!canManageThreads || bulkResolving || resolvedVisibleCount === 0
					}
					title={
						!canManageThreads
							? t('comments.bulk.noPermissionTitle')
							: resolvedVisibleCount === 0
								? t('comments.bulk.noResolvedThreadsTitle')
								: t('comments.bulk.reopenVisibleTitle', {
										count: resolvedVisibleCount,
									})
					}
				>
					<XCircleIcon width={14} height={14} className="mr-1.5" />
					{t('comments.bulk.reopen', { count: resolvedVisibleCount })}
				</DesktopAppButton>
			</div>
			{showHotkeysHelp ? (
				<div className="mt-2 rounded-lg border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) px-3 py-2 text-[11px] text-(--desktop-text-dim)">
					{t('comments.hotkeysInline')}
				</div>
			) : null}
		</div>
	);
}
