/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWDesk feed list column — search, filters, listbox rows, load-more sentinel.
 *
 * Invariants:
 * - List loads without post body; full Markdown fetched per selected id only.
 * - Text search and list filters (pinned/unread/starred/sort) use server GET /news query params.
 *
 * Related:
 * - `pages/Desktop/components/EWDeskApp.tsx`
 * - `documentation/product/desktop/EWDESK-NEWS.md`
 */
import { cn } from '@/utils/cn';
import type { TFunction } from 'i18next';
import * as React from 'react';
import type { DesktopWindowStyle } from '../../../../types/profile';
import type { CompanyNewsPostListItem } from '../../services/productDesktopApi';
import {
	DESKTOP_LUCIDE,
	DESKTOP_SURFACE,
	DESKTOP_TYPOGRAPHY,
} from '../../constants';
import {
	getDesktopShellHeaderStripClassName,
	getDesktopShellNavRailClassName,
	getDesktopShellToolbarClusterClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '../../utils/desktopVisualSystem';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppInput,
	DesktopAppSectionLabel,
	DesktopAppSkeleton,
} from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import {
	ArrowPathIcon,
	ArrowsUpDownIcon,
	ExclamationCircleIcon,
	InboxIcon,
	MagnifyingGlassIcon,
	MapPinIcon,
	NewspaperIcon,
	StarIcon,
} from '@heroicons/react/24/outline';
import {
	EW_DESK_DETAIL_PANEL_ID,
	EW_DESK_LISTBOX_ID,
	EW_DESK_LIST_SKELETON_STAGGER,
	ewDeskListOptionDomId,
} from './ewDeskConstants';
import { EwDeskNewsListRow } from './EwDeskNewsListRow';

export interface EwDeskFeedListSectionProps {
	t: TFunction<'desktopUi', 'ewDesk'>;
	shellFrame: DesktopWindowStyle;
	listColumnRef: React.RefObject<HTMLDivElement | null>;
	showListColumn: boolean;
	listFeed: {
		isLoading: boolean;
		isError: boolean;
		isFetching: boolean;
		isFetchingNextPage: boolean;
		hasNextPage: boolean;
		serverTotal: number;
		refetch: () => Promise<unknown>;
	};
	unreadCount: number;
	starredCount: number;
	showLoadedOfTotal: boolean;
	hasActiveFilters: boolean;
	posts: CompanyNewsPostListItem[];
	listFiltersActive: boolean;
	activeFilterSummary: string;
	searchQuery: string;
	setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
	searchInputRef: React.RefObject<HTMLInputElement | null>;
	isSearchFilterPending: boolean;
	deferredSearchQuery: string;
	pinnedOnly: boolean;
	setPinnedOnly: React.Dispatch<React.SetStateAction<boolean>>;
	unreadOnly: boolean;
	setUnreadOnly: React.Dispatch<React.SetStateAction<boolean>>;
	starredOnly: boolean;
	setStarredOnly: React.Dispatch<React.SetStateAction<boolean>>;
	sortOrder: 'newest' | 'oldest';
	setSortOrder: React.Dispatch<React.SetStateAction<'newest' | 'oldest'>>;
	resetListFilters: () => void;
	handleMarkAllRead: () => void;
	showKeyboardHints: boolean;
	listReady: boolean;
	filteredPosts: CompanyNewsPostListItem[];
	selectedId: string | null;
	readIds: Set<string>;
	starredIds: Set<string>;
	getOptionButtonRef: (id: string) => (el: HTMLButtonElement | null) => void;
	getOptionTabIndex: (index: number) => number;
	handleOptionKeyDown: (
		e: React.KeyboardEvent<HTMLButtonElement>,
		index: number
	) => void;
	handleSelectPost: (id: string) => void;
	prefetchPostDetailOnHover: (id: string) => void;
	handleListRowContextMenu: (e: React.MouseEvent, postId: string) => void;
	loadMoreSentinelRef: React.RefObject<HTMLDivElement | null>;
}

export function EwDeskFeedListSection({
	t,
	shellFrame,
	listColumnRef,
	showListColumn,
	listFeed,
	unreadCount,
	starredCount,
	showLoadedOfTotal,
	hasActiveFilters,
	posts,
	listFiltersActive,
	activeFilterSummary,
	searchQuery,
	setSearchQuery,
	searchInputRef,
	isSearchFilterPending,
	deferredSearchQuery,
	pinnedOnly,
	setPinnedOnly,
	unreadOnly,
	setUnreadOnly,
	starredOnly,
	setStarredOnly,
	sortOrder,
	setSortOrder,
	resetListFilters,
	handleMarkAllRead,
	showKeyboardHints,
	listReady,
	filteredPosts,
	selectedId,
	readIds,
	starredIds,
	getOptionButtonRef,
	getOptionTabIndex,
	handleOptionKeyDown,
	handleSelectPost,
	prefetchPostDetailOnHover,
	handleListRowContextMenu,
	loadMoreSentinelRef,
}: EwDeskFeedListSectionProps): React.ReactElement {
	const listColumnClass = React.useMemo(
		() =>
			cn(
				'relative w-full md:w-[min(100%,22rem)] shrink-0 overflow-y-auto overscroll-y-contain scrollbar-gutter-stable border-(--desktop-border-subtle) md:border-r pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] md:pb-0',
				'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_18%,transparent)] md:bg-[color-mix(in_srgb,var(--desktop-surface-soft)_12%,transparent)]',
				DESKTOP_SURFACE.spacingMd,
				getDesktopShellNavRailClassName(shellFrame),
				'shadow-[inset_-1px_0_0_rgb(var(--desktop-fg-primary-rgb)/0.06)]',
				'md:after:pointer-events-none md:after:absolute md:after:right-0 md:after:top-[8%] md:after:z-10 md:after:h-[84%] md:after:w-px md:after:bg-linear-to-b md:after:from-transparent md:after:via-(--desktop-border-subtle) md:after:to-transparent md:after:opacity-80'
			),
		[shellFrame]
	);
	const listFeedStickyHeaderClass = React.useMemo(
		() =>
			cn(
				'sticky top-0 z-10 flex items-center justify-between gap-2 px-3 pb-2.5 pt-3 md:px-4',
				'mb-1 shadow-[0_8px_20px_-12px_rgb(0_0_0/0.12)]',
				getDesktopShellHeaderStripClassName(shellFrame)
			),
		[shellFrame]
	);
	const searchInputShellClass = React.useMemo(
		() =>
			cn(
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
				'rounded-lg py-1.5 pl-8 pr-9 text-xs transition-opacity duration-150 motion-reduce:transition-none',
				isSearchFilterPending && 'opacity-[0.88]'
			),
		[shellFrame, isSearchFilterPending]
	);
	const listFiltersToolbarClass = React.useMemo(
		() =>
			cn(
				'flex flex-wrap items-center gap-1',
				getDesktopShellToolbarClusterClassName(shellFrame),
				'rounded-(--desktop-radius-lg) p-1'
			),
		[shellFrame]
	);

	return (
		<div
			ref={listColumnRef}
			data-ed-guide="feed-list"
			className={cn(listColumnClass, !showListColumn && 'hidden')}
		>
			{listFeed.isLoading && (
				<div
					className="space-y-2.5 p-3 md:p-4"
					role="status"
					aria-busy="true"
					aria-live="polite"
					aria-label={t('listLabel')}
				>
					{[
						['w-full', 'w-3/5'],
						['w-[96%]', 'w-1/2'],
						['w-[92%]', 'w-2/3'],
						['w-full', 'w-[55%]'],
					].map(([a, b], i) => (
						<div
							key={`sk-${a}-${b}`}
							className={cn(
								'space-y-2 rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/30 p-2.5 ring-1 ring-inset ring-[rgb(var(--desktop-fg-primary-rgb)/0.04)] motion-safe:animate-fade-in motion-reduce:animate-none',
								i % 2 === 1 && 'opacity-[0.92]',
								EW_DESK_LIST_SKELETON_STAGGER[i]
							)}
						>
							<DesktopAppSkeleton className={cn('h-2.5', a)} />
							<DesktopAppSkeleton className={cn('h-2', b)} />
						</div>
					))}
				</div>
			)}
			{listFeed.isError && (
				<div className="motion-safe:animate-fade-in motion-reduce:animate-none">
					<DesktopAppEmptyState
						className="mx-auto min-h-56 w-full max-w-sm px-4"
						icon={
							<ExclamationCircleIcon
								className="h-8 w-8 text-[color-mix(in_srgb,rgb(251_113_133)_75%,var(--desktop-text-dim))]"
								aria-hidden
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						}
						title={t('listLoadErrorTitle')}
						description={t('listLoadErrorDesc')}
					>
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							aria-label={t('retryAria')}
							onClick={() => {
								void listFeed.refetch();
							}}
						>
							{t('retry')}
						</DesktopAppButton>
					</DesktopAppEmptyState>
				</div>
			)}
			{!listFeed.isLoading && !listFeed.isError && (
				<>
					<div className={listFeedStickyHeaderClass}>
						<div className="flex min-w-0 items-center gap-2.5">
							<span
								className="h-6 w-0.5 shrink-0 rounded-full bg-linear-to-b from-[rgb(var(--desktop-accent-rgb)/0.75)] via-[rgb(var(--desktop-accent-rgb)/0.35)] to-[rgb(var(--desktop-accent-rgb)/0.08)] shadow-[0_0_10px_rgb(var(--desktop-accent-rgb)/0.12)]"
								aria-hidden
							/>
							<DesktopAppSectionLabel className="mb-0 text-(--desktop-text-secondary)">
								{t('listHeading')}
							</DesktopAppSectionLabel>
							{unreadCount > 0 ? (
								<span
									role="img"
									className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.22)_100%,transparent)] px-1.5 text-[0.625rem] font-bold tabular-nums text-[rgb(var(--desktop-accent-rgb)/0.95)] ring-1 ring-inset ring-[rgb(var(--desktop-accent-rgb)/0.25)]"
									aria-label={t('unreadBadgeAria', { count: unreadCount })}
								>
									{unreadCount > 99 ? '99+' : unreadCount}
								</span>
							) : null}
							{listFeed.isFetching && !listFeed.isLoading ? (
								<span
									className="inline-flex h-5 items-center gap-1.5 rounded-full border border-(--desktop-border-subtle)/80 bg-[color-mix(in_srgb,var(--desktop-surface-soft)_85%,rgb(var(--desktop-accent-rgb)/0.06))] px-2 py-0.5"
									role="status"
									aria-label={t('listRefreshingAria')}
								>
									<span
										className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.85)] motion-safe:animate-pulse motion-reduce:animate-none"
										aria-hidden
									/>
								</span>
							) : null}
						</div>
						<DesktopChromeTooltip
							content={
								showLoadedOfTotal || hasActiveFilters
									? t('listCountFilteredAria', {
											shown: posts.length,
											total: listFeed.serverTotal,
										})
									: t('listCountAria', { count: posts.length })
							}
							placement="bottom"
							offsetExtra={4}
						>
							<span
								role="img"
								className={cn(
									'flex min-w-6.5 cursor-default items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--desktop-border-subtle)_88%,rgb(var(--desktop-accent-rgb)/0.12))] bg-[color-mix(in_srgb,var(--desktop-surface-soft)_88%,rgb(var(--desktop-accent-rgb)/0.1))] px-2 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-(--desktop-text-secondary) shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.06)]',
									filteredPosts.length === 0 &&
										posts.length === 0 &&
										'text-(--desktop-text-muted) opacity-[0.72]',
									listFeed.isFetching &&
										!listFeed.isLoading &&
										posts.length > 0 &&
										'motion-safe:animate-pulse'
								)}
								aria-label={
									showLoadedOfTotal || hasActiveFilters
										? t('listCountFilteredAria', {
												shown: posts.length,
												total: listFeed.serverTotal,
											})
										: t('listCountAria', { count: posts.length })
								}
							>
								{showLoadedOfTotal || hasActiveFilters
									? `${posts.length}/${listFeed.serverTotal}`
									: posts.length}
							</span>
						</DesktopChromeTooltip>
					</div>
					{listReady ? (
						<div className="mb-2 space-y-2 px-3 md:px-4">
							<DesktopChromeTooltip
								content={t('focusSearchHint')}
								placement="bottom"
								offsetExtra={4}
							>
								<div className="relative w-full">
									<MagnifyingGlassIcon
										className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--desktop-text-dim)"
										aria-hidden
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
									<DesktopAppInput
										ref={searchInputRef}
										type="search"
										value={searchQuery}
										onChange={(e) => {
											setSearchQuery(e.target.value);
										}}
										placeholder={t('searchPlaceholder')}
										aria-label={t('searchAria')}
										autoComplete="off"
										className={cn('w-full', searchInputShellClass)}
									/>
									{searchQuery ? (
										<DesktopAppButton
											type="button"
											variant="ghost"
											size="sm"
											className="absolute right-0.5 top-1/2 h-7 min-w-0 -translate-y-1/2 px-2 text-[0.6875rem] text-(--desktop-text-muted)"
											aria-label={t('clearSearchAria')}
											onClick={() => {
												setSearchQuery('');
											}}
										>
											{t('clearSearch')}
										</DesktopAppButton>
									) : null}
								</div>
							</DesktopChromeTooltip>
							<div className={listFiltersToolbarClass}>
								<DesktopAppButton
									type="button"
									variant={sortOrder === 'newest' ? 'neutral' : 'ghost'}
									size="sm"
									className="h-7 gap-1 px-2 text-[0.6875rem]"
									aria-pressed={sortOrder === 'newest'}
									aria-label={t('sortNewestAria')}
									onClick={() => {
										setSortOrder('newest');
									}}
								>
									<ArrowsUpDownIcon
										className="h-3.5 w-3.5 shrink-0 opacity-90"
										aria-hidden
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
									{t('sortNewest')}
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									variant={sortOrder === 'oldest' ? 'neutral' : 'ghost'}
									size="sm"
									className="h-7 gap-1 px-2 text-[0.6875rem]"
									aria-pressed={sortOrder === 'oldest'}
									aria-label={t('sortOldestAria')}
									onClick={() => {
										setSortOrder('oldest');
									}}
								>
									<ArrowsUpDownIcon
										className="h-3.5 w-3.5 shrink-0 opacity-90"
										aria-hidden
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
									{t('sortOldest')}
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									variant={pinnedOnly ? 'neutral' : 'ghost'}
									size="sm"
									className="h-7 gap-1 px-2 text-[0.6875rem]"
									aria-pressed={pinnedOnly}
									aria-label={t('pinnedOnlyAria')}
									onClick={() => {
										setPinnedOnly((v) => !v);
									}}
								>
									<MapPinIcon
										className="h-3.5 w-3.5 shrink-0 opacity-90"
										aria-hidden
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
									{t('pinnedOnly')}
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									variant={unreadOnly ? 'neutral' : 'ghost'}
									size="sm"
									className="h-7 gap-1 px-2 text-[0.6875rem]"
									aria-pressed={unreadOnly}
									aria-label={t('unreadOnlyAria')}
									disabled={unreadCount === 0 && !unreadOnly}
									onClick={() => {
										setUnreadOnly((v) => !v);
									}}
								>
									<InboxIcon
										className="h-3.5 w-3.5 shrink-0 opacity-90"
										aria-hidden
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
									{t('unreadOnly')}
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									variant={starredOnly ? 'neutral' : 'ghost'}
									size="sm"
									className="h-7 gap-1 px-2 text-[0.6875rem]"
									aria-pressed={starredOnly}
									aria-label={t('starredOnlyAria')}
									disabled={starredCount === 0 && !starredOnly}
									onClick={() => {
										setStarredOnly((v) => !v);
									}}
								>
									<StarIcon
										className="h-3.5 w-3.5 shrink-0 opacity-90"
										aria-hidden
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
									{t('starredOnly')}
								</DesktopAppButton>
								{unreadCount > 0 ? (
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										className="h-7 gap-1 px-2 text-[0.6875rem] text-(--desktop-text-secondary)"
										aria-label={t('markAllReadAria')}
										onClick={handleMarkAllRead}
									>
										{t('markAllRead')}
									</DesktopAppButton>
								) : null}
								{listFiltersActive ? (
									<DesktopAppButton
										type="button"
										variant="neutral"
										size="sm"
										className="h-7 px-2 text-[0.6875rem]"
										aria-label={t('resetFiltersAria')}
										onClick={resetListFilters}
									>
										{t('resetFilters')}
									</DesktopAppButton>
								) : null}
							</div>
							{listFiltersActive ? (
								<p
									className={`${DESKTOP_TYPOGRAPHY.meta} px-0.5 text-(--desktop-text-muted)`}
								>
									{t('filtersEscHint')}
								</p>
							) : null}
							{listFiltersActive && activeFilterSummary ? (
								<p
									className={`${DESKTOP_TYPOGRAPHY.meta} px-0.5 text-(--desktop-text-secondary)`}
									aria-live="polite"
								>
									{t('activeFiltersSummary', { summary: activeFilterSummary })}
								</p>
							) : null}
							{showKeyboardHints ? (
								<p
									className={`${DESKTOP_TYPOGRAPHY.meta} rounded-(--desktop-radius) border border-(--desktop-border-subtle)/80 bg-[color-mix(in_srgb,var(--desktop-surface-soft)_70%,transparent)] px-2 py-1.5 text-(--desktop-text-muted)`}
								>
									{t('keyboardHintsPanel')}
								</p>
							) : null}
						</div>
					) : null}
				</>
			)}
			{!listFeed.isLoading && !listFeed.isError && posts.length === 0 && (
				<div className="motion-safe:animate-fade-in motion-reduce:animate-none">
					<DesktopAppEmptyState
						className="mx-auto min-h-48 w-full max-w-sm px-4 py-6"
						icon={
							hasActiveFilters ? (
								<MagnifyingGlassIcon
									className="h-8 w-8 text-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.88)_42%,var(--desktop-text-dim))]"
									aria-hidden
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							) : (
								<NewspaperIcon
									className="h-8 w-8 text-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.88)_42%,var(--desktop-text-dim))]"
									aria-hidden
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							)
						}
						title={
							hasActiveFilters ? t('noSearchResultsTitle') : t('emptyTitle')
						}
						description={
							hasActiveFilters ? t('noSearchResultsDesc') : t('emptyDesc')
						}
					>
						{hasActiveFilters ? (
							<DesktopAppButton
								type="button"
								variant="neutral"
								size="sm"
								aria-label={t('resetFiltersAria')}
								onClick={resetListFilters}
							>
								{t('resetFilters')}
							</DesktopAppButton>
						) : null}
					</DesktopAppEmptyState>
				</div>
			)}
			{filteredPosts.length > 0 ? (
				<div
					id={EW_DESK_LISTBOX_ID}
					role="listbox"
					tabIndex={0}
					aria-activedescendant={
						selectedId ? ewDeskListOptionDomId(selectedId) : undefined
					}
					className={cn(
						'scroll-smooth flex flex-col gap-1.5 p-2 pb-4 pt-1 transition-opacity duration-150 motion-reduce:transition-none md:p-3 md:pb-5 md:pt-2',
						isSearchFilterPending && 'opacity-[0.92]'
					)}
					aria-label={t('listLabel')}
				>
					{filteredPosts.map((p, index) => (
						<EwDeskNewsListRow
							key={p.id}
							post={p}
							index={index}
							isSelected={selectedId === p.id}
							tabIndex={getOptionTabIndex(index)}
							detailPanelId={EW_DESK_DETAIL_PANEL_ID}
							listboxOptionId={ewDeskListOptionDomId(p.id)}
							buttonRef={getOptionButtonRef(p.id)}
							onSelect={handleSelectPost}
							onOptionKeyDown={handleOptionKeyDown}
							isUnread={!readIds.has(p.id)}
							isStarred={starredIds.has(p.id)}
							onPrefetchPost={prefetchPostDetailOnHover}
							onRowContextMenu={handleListRowContextMenu}
							searchHighlightQuery={deferredSearchQuery.trim()}
						/>
					))}
					{listFeed.hasNextPage || listFeed.isFetchingNextPage ? (
						<div
							className="flex min-h-8 items-center justify-center px-1 pt-1 pb-2"
							aria-live="polite"
							role="presentation"
						>
							<div
								ref={loadMoreSentinelRef}
								className="flex w-full max-w-[16rem] items-center justify-center gap-1.5 py-1 text-[0.6875rem] text-(--desktop-text-muted)"
								role="status"
								aria-label={
									listFeed.isFetchingNextPage
										? t('loadMoreLoadingAria')
										: t('loadMoreAria', {
												loaded: posts.length,
												serverTotal: listFeed.serverTotal,
											})
								}
							>
								{listFeed.isFetchingNextPage ? (
									<>
										<ArrowPathIcon
											className="h-3.5 w-3.5 shrink-0 motion-safe:animate-spin motion-reduce:animate-none"
											aria-hidden
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
										{t('loadingMore')}
									</>
								) : (
									t('loadMore', {
										loaded: posts.length,
										serverTotal: listFeed.serverTotal,
									})
								)}
							</div>
						</div>
					) : null}
				</div>
			) : null}
		</div>
	);
}
