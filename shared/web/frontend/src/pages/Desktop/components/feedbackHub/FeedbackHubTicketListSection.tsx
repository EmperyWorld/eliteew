/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Ticket history panel for Feedback Hub: filters, paged list, load-more, and empty states.
 *
 * Invariants:
 * - Author-visible tickets only; admin_notes rendered as team reply when present.
 * - Filter/search state controlled by parent; no duplicate fetch logic here.
 *
 * Related:
 * - FeedbackHubTicketCard.tsx · FEEDBACK-HUB.md
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import {
	ArrowPathIcon,
	BarsArrowDownIcon,
	BarsArrowUpIcon,
	InboxIcon,
	MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '../../constants';
import type { FeedbackKindFilter } from '../feedbackQueryOptions';
import type { FeedbackTicket } from '../../services/productDesktopApi';
import {
	FEEDBACK_STATUSES,
	feedbackStatusLabel,
} from '../../utils/feedbackLabels';
import type { FeedbackStatusFilter } from '../../utils/feedbackHubTicketFilters';
import {
	DESKTOP_CHROME_FOCUS_VISIBLE,
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppSectionLabel,
	DesktopAppSurface,
	DesktopNativeSelect,
	DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME,
} from '../DesktopAppChrome';
import { DesktopChromeTooltip } from '../DesktopChromeTooltip';
import { FeedbackHubTicketCard } from './FeedbackHubTicketCard';

type KindFilter = FeedbackKindFilter;

export type FeedbackHubTicketListSectionProps = {
	embeddedMobileLayout: boolean;
	listStatusText: string;
	refreshAriaLabel: string;
	listToolbarClusterClass: string;
	listSearchInputClass: string;
	listSearchInputRef: React.RefObject<HTMLInputElement | null>;
	listQueryText: string;
	onListQueryTextChange: (value: string) => void;
	kindFilter: KindFilter;
	onKindFilterChange: (value: KindFilter) => void;
	statusFilter: FeedbackStatusFilter;
	onStatusFilterChange: (value: FeedbackStatusFilter) => void;
	newestFirst: boolean;
	onNewestFirstToggle: () => void;
	listFiltersActive: boolean;
	onResetListFilters: () => void;
	onRefresh: () => void;
	isListLoading: boolean;
	isListError: boolean;
	isListFetching: boolean;
	isFetchingNextPage: boolean;
	hasNextPage: boolean;
	onLoadMore: () => void;
	ticketsLength: number;
	shownCount: number;
	loadedCount: number;
	listTotal: number;
	filteredTickets: FeedbackTicket[];
	highlightedId: string | null;
	onCopyTicketId: (ticketId: string) => void;
	onFocusNewTicketForm: () => void;
};

export function FeedbackHubTicketListSection({
	embeddedMobileLayout,
	listStatusText,
	refreshAriaLabel,
	listToolbarClusterClass,
	listSearchInputClass,
	listSearchInputRef,
	listQueryText,
	onListQueryTextChange,
	kindFilter,
	onKindFilterChange,
	statusFilter,
	onStatusFilterChange,
	newestFirst,
	onNewestFirstToggle,
	listFiltersActive,
	onResetListFilters,
	onRefresh,
	isListLoading,
	isListError,
	isListFetching,
	isFetchingNextPage,
	hasNextPage,
	onLoadMore,
	ticketsLength,
	shownCount,
	loadedCount,
	listTotal,
	filteredTickets,
	highlightedId,
	onCopyTicketId,
	onFocusNewTicketForm,
}: FeedbackHubTicketListSectionProps): React.ReactElement {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'feedbackHub' });
	const { t: tFeedbackLabels, i18n } = useTranslation('desktopUi');

	return (
		<section
			className="min-w-0"
			aria-labelledby="feedback-list-heading"
			data-feedback-hub-guide="ticket-list"
		>
			<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<DesktopAppSectionLabel
						id="feedback-list-heading"
						className="mb-1 normal-case! tracking-normal!"
					>
						{t('myTickets')}
					</DesktopAppSectionLabel>
					<p
						className={DESKTOP_TYPOGRAPHY.meta}
						aria-live="polite"
						aria-atomic="true"
					>
						{listStatusText}
					</p>
				</div>
				<DesktopChromeTooltip
					content={refreshAriaLabel}
					placement="top"
					offsetExtra={4}
				>
					<DesktopAppButton
						type="button"
						size="sm"
						variant="neutral"
						className="shrink-0 gap-2 self-start"
						disabled={isListFetching && isListLoading}
						aria-label={refreshAriaLabel}
						aria-busy={isListFetching || undefined}
						onClick={onRefresh}
					>
						<ArrowPathIcon
							className={cn('h-4 w-4', isListFetching && 'animate-spin')}
							aria-hidden
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
						{t('refresh')}
					</DesktopAppButton>
				</DesktopChromeTooltip>
			</div>

			<div
				className={listToolbarClusterClass}
				data-feedback-hub-guide="list-filters"
			>
				<DesktopChromeTooltip
					content={t('focusSearchHint')}
					placement="bottom"
					offsetExtra={4}
				>
					<div className="relative w-full">
						<MagnifyingGlassIcon
							className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--desktop-text-dim)"
							aria-hidden
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
						<input
							ref={listSearchInputRef}
							type="search"
							value={listQueryText}
							onChange={(e) => onListQueryTextChange(e.target.value)}
							placeholder={t('searchPlaceholder')}
							className={cn(
								listSearchInputClass,
								'rounded-(--desktop-radius)',
								listQueryText ? 'pr-16' : undefined
							)}
							aria-label={t('searchAria')}
						/>
						{listQueryText ? (
							<DesktopChromeTooltip
								content={t('clearSearch')}
								placement="top"
								offsetExtra={4}
							>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="sm"
									className={cn(
										'absolute right-0.5 top-1/2 h-7 min-w-0 -translate-y-1/2 px-2',
										DESKTOP_TYPOGRAPHY.caption
									)}
									aria-label={t('clearSearchAria')}
									onClick={() => onListQueryTextChange('')}
								>
									{t('clearSearch')}
								</DesktopAppButton>
							</DesktopChromeTooltip>
						) : null}
					</div>
				</DesktopChromeTooltip>
				<div className="flex flex-wrap items-center gap-2">
					<span className={DESKTOP_TYPOGRAPHY.caption}>{t('typeLabel')}</span>
					{(
						[
							['all', t('kindAll')],
							['wish', t('kindWish')],
							['bug', t('kindBug')],
						] as const
					).map(([v, label]) => (
						<button
							key={v}
							type="button"
							onClick={() => onKindFilterChange(v)}
							aria-pressed={kindFilter === v}
							className={cn(
								'rounded-(--desktop-radius-pill) border px-2.5 py-1 transition-colors',
								DESKTOP_TYPOGRAPHY.meta,
								'font-medium',
								DESKTOP_CHROME_FOCUS_VISIBLE,
								kindFilter === v
									? 'border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-(--desktop-text-primary)'
									: 'border-(--desktop-border-subtle) text-(--desktop-text-muted) hover:bg-(--desktop-surface-soft-hover)'
							)}
						>
							{label}
						</button>
					))}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<span className={DESKTOP_TYPOGRAPHY.caption}>{t('statusLabel')}</span>
					<DesktopNativeSelect
						value={statusFilter}
						onChange={(e) =>
							onStatusFilterChange(e.target.value as FeedbackStatusFilter)
						}
						className="min-w-40 flex-1 sm:flex-none"
						aria-label={t('ariaStatusFilter')}
					>
						<option
							className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
							value="all"
						>
							{t('statusAll')}
						</option>
						{FEEDBACK_STATUSES.map((s) => (
							<option
								key={s}
								className={DESKTOP_NATIVE_SELECT_OPTION_CLASSNAME}
								value={s}
							>
								{feedbackStatusLabel(s, tFeedbackLabels)}
							</option>
						))}
					</DesktopNativeSelect>
					<DesktopAppButton
						type="button"
						size="sm"
						variant="ghost"
						className="gap-1.5"
						aria-pressed={newestFirst}
						aria-label={newestFirst ? t('sortNewestAria') : t('sortOldestAria')}
						onClick={onNewestFirstToggle}
					>
						{newestFirst ? (
							<BarsArrowDownIcon
								className="h-4 w-4"
								aria-hidden
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						) : (
							<BarsArrowUpIcon
								className="h-4 w-4"
								aria-hidden
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						)}
						{newestFirst ? t('sortNewest') : t('sortOldest')}
					</DesktopAppButton>
				</div>
			</div>

			{listFiltersActive && embeddedMobileLayout ? (
				<div className="-mt-1 mb-2 flex flex-wrap items-center justify-between gap-2">
					<p className={DESKTOP_TYPOGRAPHY.meta}>
						{t('filtersActiveMobileHint')}
					</p>
					<DesktopAppButton
						type="button"
						size="sm"
						variant="neutral"
						aria-label={t('resetFiltersAria')}
						onClick={onResetListFilters}
					>
						{t('resetFilters')}
					</DesktopAppButton>
				</div>
			) : null}

			{listFiltersActive && !embeddedMobileLayout ? (
				<p className={`${DESKTOP_TYPOGRAPHY.meta} -mt-1`}>
					{t('filtersEscHint')}
				</p>
			) : null}

			{isListLoading && (
				<div
					className={cn(
						'flex min-h-[128px] flex-col items-center justify-center gap-2 rounded-(--desktop-radius-lg)',
						'border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/80',
						'text-(--desktop-text-dim)'
					)}
					aria-busy="true"
					aria-live="polite"
				>
					<ArrowPathIcon
						className="h-8 w-8 animate-spin text-[rgb(var(--desktop-accent-rgb))]"
						aria-hidden
						strokeWidth={DESKTOP_LUCIDE.stroke}
					/>
					<span className={DESKTOP_TYPOGRAPHY.small}>
						{t('listStatusLoading')}
					</span>
				</div>
			)}

			{isListError && (
				<DesktopAppSurface variant="soft" padding="lg">
					<div className="flex flex-col items-center gap-3 text-center">
						<p className={DESKTOP_TYPOGRAPHY.body}>{t('loadError')}</p>
						<DesktopAppButton
							type="button"
							size="sm"
							variant="accent"
							className="gap-2"
							aria-label={t('retryAria')}
							onClick={onRefresh}
						>
							<ArrowPathIcon
								className="h-4 w-4"
								aria-hidden
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
							{t('retry')}
						</DesktopAppButton>
					</div>
				</DesktopAppSurface>
			)}

			{!isListLoading && !isListError && ticketsLength === 0 && (
				<DesktopAppEmptyState
					icon={
						<InboxIcon
							className="h-8 w-8 text-slate-500"
							aria-hidden
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					}
					title={t('emptyTitle')}
					description={t('emptyDesc')}
				>
					<DesktopAppButton
						type="button"
						size="sm"
						variant="accent"
						aria-label={t('emptyWriteCtaAria')}
						onClick={onFocusNewTicketForm}
					>
						{t('emptyWriteCta')}
					</DesktopAppButton>
				</DesktopAppEmptyState>
			)}

			{!isListLoading &&
				!isListError &&
				ticketsLength > 0 &&
				shownCount === 0 && (
					<DesktopAppSurface variant="soft" padding="lg">
						<div className="flex flex-col items-center gap-3 text-center">
							<p className={DESKTOP_TYPOGRAPHY.body}>{t('emptyFilter')}</p>
							{listFiltersActive ? (
								<DesktopAppButton
									type="button"
									size="sm"
									variant="neutral"
									aria-label={t('resetFiltersAria')}
									onClick={onResetListFilters}
								>
									{t('resetFilters')}
								</DesktopAppButton>
							) : null}
						</div>
					</DesktopAppSurface>
				)}

			<ul
				className="space-y-3"
				aria-label={t('ticketsListAria', { count: shownCount })}
			>
				{highlightedId ? (
					<li className="sr-only" aria-live="polite" aria-atomic="true">
						{t('ticketHighlightedAria')}
					</li>
				) : null}
				{filteredTickets.map((ticket: FeedbackTicket) => (
					<li key={ticket.id}>
						<FeedbackHubTicketCard
							ticket={ticket}
							highlightedId={highlightedId}
							t={t}
							tFeedbackLabels={tFeedbackLabels}
							locale={i18n.language}
							onCopyTicketId={onCopyTicketId}
						/>
					</li>
				))}
			</ul>

			{hasNextPage && (
				<div className="flex justify-center pt-2">
					<DesktopAppButton
						type="button"
						size="sm"
						variant="neutral"
						disabled={isFetchingNextPage}
						aria-busy={isFetchingNextPage || undefined}
						aria-label={
							isFetchingNextPage
								? t('loadMoreLoadingAria')
								: t('loadMoreAria', {
										loaded: loadedCount,
										serverTotal: listTotal,
									})
						}
						onClick={onLoadMore}
						className="min-w-[200px]"
					>
						{isFetchingNextPage ? (
							<>
								<ArrowPathIcon
									className="mr-2 h-4 w-4 animate-spin"
									aria-hidden
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
								{t('loadingMore')}
							</>
						) : (
							t('loadMore', { loaded: loadedCount, serverTotal: listTotal })
						)}
					</DesktopAppButton>
				</div>
			)}
		</section>
	);
}
