/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Survey Hub desktop shell: hero, available surveys, history, and runner orchestration.
 */
import { cn } from '@/utils/cn';
import {
	ArrowPathIcon,
	BarsArrowDownIcon,
	BarsArrowUpIcon,
	CheckBadgeIcon,
	ClipboardDocumentListIcon,
	SparklesIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppContentWrapper,
	DesktopAppEmptyState,
	DesktopAppErrorState,
	DesktopAppPanel,
	DesktopAppSectionLabel,
	DesktopAppSkeleton,
	DesktopProductNextAction,
	DesktopProductWorkspace,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	fetchMySurveyResponse,
	fetchSurveyDetail,
	fetchSurveySummary,
	fetchSurveys,
	type SurveyUserListItem,
} from '@/pages/Desktop/services/productDesktopSurveysApi';
import {
	SH_HERO_PANEL_CLASS,
	SH_KPI_GRID_CLASS,
	SH_KPI_TILE_CLASS,
	SH_SECTION_STACK_CLASS,
	SH_SURVEY_CARD_CLASS,
	SH_SURVEY_CARD_COMPLETED_CLASS,
	SH_SURVEY_CARD_URGENT_CLASS,
} from './surveyHubLayoutTokens';
import { SurveyRunner } from './SurveyRunner';
import {
	clearSurveyHubHistoryPrefs,
	isSurveyHubHistoryFiltersActive,
	persistHistoryNewestFirst,
	persistHistorySearchQuery,
	readHistoryNewestFirst,
	readHistorySearchQuery,
} from './surveyHubHistorySession';
import {
	estimateSurveyMinutes,
	filterSurveyListByQuery,
	formatSurveyDateLabel,
	sortAvailableSurveysByDeadline,
	sortCompletedSurveysByDate,
	surveyClosesSoon,
	surveyHasReward,
} from './surveyHubUserUtils';

export type SurveyHubDesktopAppProps = {
	initialSurveyId?: string;
};

function RewardBadges({
	reward,
}: {
	reward: { ugs_credits: number; ew_balance: number; web_search_coins: number };
}): React.ReactElement | null {
	const { t } = useTranslation('surveys');
	const parts: string[] = [];
	if (reward.ugs_credits > 0)
		parts.push(t('badges.ugs', { count: reward.ugs_credits }));
	if (reward.ew_balance > 0)
		parts.push(t('badges.ew', { count: reward.ew_balance }));
	if (reward.web_search_coins > 0)
		parts.push(t('badges.coins', { count: reward.web_search_coins }));
	if (!parts.length) return null;
	return (
		<p
			className={cn(
				DESKTOP_TYPOGRAPHY.caption,
				'font-medium text-[rgb(var(--desktop-accent-rgb)/0.95)]'
			)}
		>
			{parts.join(' · ')}
		</p>
	);
}

function SurveyListSkeleton(): React.ReactElement {
	return (
		<div className="grid gap-3 md:grid-cols-2">
			<DesktopAppSkeleton className="h-36 rounded-(--desktop-radius-lg)" />
			<DesktopAppSkeleton className="h-36 rounded-(--desktop-radius-lg)" />
		</div>
	);
}

export default function SurveyHubDesktopApp({
	initialSurveyId,
}: SurveyHubDesktopAppProps): React.ReactElement {
	const { t } = useTranslation('surveys');
	const qc = useQueryClient();
	const [activeId, setActiveId] = React.useState<string | null>(
		initialSurveyId ?? null
	);
	const [historyId, setHistoryId] = React.useState<string | null>(null);
	const [historyQuery, setHistoryQuery] = React.useState(
		readHistorySearchQuery
	);
	const [historyNewestFirst, setHistoryNewestFirst] = React.useState(
		readHistoryNewestFirst
	);

	const summaryQ = useQuery({
		queryKey: ['survey-hub', 'summary'],
		queryFn: fetchSurveySummary,
	});
	const availableQ = useQuery({
		queryKey: ['survey-hub', 'available'],
		queryFn: () => fetchSurveys('available'),
	});
	const completedQ = useQuery({
		queryKey: ['survey-hub', 'completed'],
		queryFn: () => fetchSurveys('completed'),
	});
	const detailQ = useQuery({
		queryKey: ['survey-hub', 'detail', activeId],
		queryFn: () => fetchSurveyDetail(activeId ?? ''),
		enabled: Boolean(activeId),
	});
	const historyDetailQ = useQuery({
		queryKey: ['survey-hub', 'detail', historyId],
		queryFn: () => fetchSurveyDetail(historyId ?? ''),
		enabled: Boolean(historyId),
	});
	const historyRespQ = useQuery({
		queryKey: ['survey-hub', 'my-response', historyId],
		queryFn: () => fetchMySurveyResponse(historyId ?? ''),
		enabled: Boolean(historyId),
	});
	const activeCompletedRespQ = useQuery({
		queryKey: ['survey-hub', 'my-response', activeId, 'completed'],
		queryFn: () => fetchMySurveyResponse(activeId ?? ''),
		enabled: Boolean(activeId && detailQ.data?.completed),
	});

	const invalidateAll = React.useCallback(async () => {
		await qc.invalidateQueries({ queryKey: ['survey-hub'] });
	}, [qc]);

	const openSurvey = (item: SurveyUserListItem) => {
		if (item.completed) {
			setHistoryId(item.id);
			setActiveId(null);
			return;
		}
		setHistoryId(null);
		setActiveId(item.id);
	};

	const sortedAvailable = React.useMemo(
		() => sortAvailableSurveysByDeadline(availableQ.data?.items ?? []),
		[availableQ.data?.items]
	);

	const sortedCompleted = React.useMemo(
		() =>
			sortCompletedSurveysByDate(
				completedQ.data?.items ?? [],
				historyNewestFirst ? 'newest' : 'oldest'
			),
		[completedQ.data?.items, historyNewestFirst]
	);

	const nextSurvey = sortedAvailable[0] ?? null;
	const listLoadError = availableQ.isError || completedQ.isError;
	const filteredHistory = React.useMemo(
		() => filterSurveyListByQuery(sortedCompleted, historyQuery),
		[sortedCompleted, historyQuery]
	);

	const historyFiltersActive = React.useMemo(
		() =>
			isSurveyHubHistoryFiltersActive({
				newestFirst: historyNewestFirst,
				searchQuery: historyQuery,
			}),
		[historyNewestFirst, historyQuery]
	);

	const resetHistoryFilters = React.useCallback(() => {
		setHistoryQuery('');
		setHistoryNewestFirst(true);
		clearSurveyHubHistoryPrefs();
	}, []);

	const hero = (
		<div className={SH_HERO_PANEL_CLASS}>
			<div className="flex items-start gap-3">
				<div
					className="flex h-10 w-10 shrink-0 items-center justify-center rounded-(--desktop-radius) border border-[rgb(var(--desktop-accent-rgb)/0.3)] bg-(--desktop-surface-panel)"
					aria-hidden
				>
					<SparklesIcon
						className="h-5 w-5 text-[rgb(var(--desktop-accent-rgb))]"
						strokeWidth={DESKTOP_LUCIDE.stroke}
					/>
				</div>
				<div className="min-w-0 flex-1">
					<h1 className={DESKTOP_TYPOGRAPHY.title}>{t('hero.title')}</h1>
					<p
						className={cn(
							'mt-2 max-w-2xl',
							DESKTOP_TYPOGRAPHY.body,
							'text-(--desktop-text-secondary)'
						)}
					>
						{t('hero.body')}
					</p>
				</div>
			</div>
			{summaryQ.isLoading ? (
				<div className={SH_KPI_GRID_CLASS}>
					<DesktopAppSkeleton className="h-14 rounded-(--desktop-radius)" />
					<DesktopAppSkeleton className="h-14 rounded-(--desktop-radius)" />
					<DesktopAppSkeleton className="h-14 rounded-(--desktop-radius)" />
				</div>
			) : summaryQ.data ? (
				<div className={SH_KPI_GRID_CLASS}>
					<div className={SH_KPI_TILE_CLASS}>
						<p className={DESKTOP_TYPOGRAPHY.labelOverline}>
							{t('hero.kpi.available')}
						</p>
						<p className="mt-1 text-lg font-semibold tabular-nums text-(--desktop-text-primary)">
							{summaryQ.data.available_count}
						</p>
					</div>
					<div className={SH_KPI_TILE_CLASS}>
						<p className={DESKTOP_TYPOGRAPHY.labelOverline}>
							{t('hero.kpi.completed')}
						</p>
						<p className="mt-1 text-lg font-semibold tabular-nums text-(--desktop-text-primary)">
							{summaryQ.data.completed_count}
						</p>
					</div>
					<div className={SH_KPI_TILE_CLASS}>
						<p className={DESKTOP_TYPOGRAPHY.labelOverline}>
							{t('hero.kpi.earned')}
						</p>
						<p
							className={cn(
								'mt-1 text-sm font-medium text-(--desktop-text-secondary)',
								DESKTOP_TYPOGRAPHY.meta
							)}
						>
							{t('hero.kpi.earnedSummary', {
								ugs: summaryQ.data.total_reward_ugs,
								ew: summaryQ.data.total_reward_ew,
								coins: summaryQ.data.total_reward_coins,
							})}
						</p>
					</div>
				</div>
			) : summaryQ.isError ? (
				<DesktopAppErrorState
					message={t('errors.loadFailed')}
					actionLabel={t('errors.retry')}
					onAction={() => void summaryQ.refetch()}
				/>
			) : null}
		</div>
	);

	if (activeId && detailQ.isLoading) {
		return (
			<DesktopAppContentWrapper>
				<DesktopProductWorkspace
					header={
						<div className="px-4 pt-4">
							<DesktopAppSkeleton className="h-7 w-2/3 max-w-md" />
						</div>
					}
				>
					<DesktopAppPanel className="m-4 p-6">
						<DesktopAppSkeleton className="mb-4 h-2 w-full rounded-full" />
						<DesktopAppSkeleton className="h-40 w-full rounded-(--desktop-radius-lg)" />
					</DesktopAppPanel>
				</DesktopProductWorkspace>
			</DesktopAppContentWrapper>
		);
	}

	if (activeId && detailQ.isError) {
		return (
			<DesktopAppContentWrapper>
				<DesktopProductWorkspace>
					<DesktopAppPanel className="m-4 flex flex-col gap-4 p-6">
						<DesktopAppErrorState
							message={t('errors.surveyLoadFailed')}
							actionLabel={t('errors.retry')}
							onAction={() => void detailQ.refetch()}
						/>
						<DesktopAppButton
							type="button"
							variant="neutral"
							onClick={() => setActiveId(null)}
						>
							{t('runner.backToList')}
						</DesktopAppButton>
					</DesktopAppPanel>
				</DesktopProductWorkspace>
			</DesktopAppContentWrapper>
		);
	}

	if (activeId && detailQ.data) {
		if (detailQ.data.completed) {
			if (activeCompletedRespQ.isLoading) {
				return (
					<DesktopAppContentWrapper>
						<DesktopProductWorkspace>
							<DesktopAppPanel className="m-4 p-6">
								<DesktopAppSkeleton className="h-40 w-full" />
							</DesktopAppPanel>
						</DesktopProductWorkspace>
					</DesktopAppContentWrapper>
				);
			}
			if (activeCompletedRespQ.isError || !activeCompletedRespQ.data) {
				return (
					<DesktopAppContentWrapper>
						<DesktopProductWorkspace>
							<DesktopAppPanel className="m-4 flex flex-col gap-4 p-6">
								<DesktopAppErrorState
									message={t('errors.surveyLoadFailed')}
									actionLabel={t('errors.retry')}
									onAction={() => void activeCompletedRespQ.refetch()}
								/>
								<DesktopAppButton
									type="button"
									variant="neutral"
									onClick={() => setActiveId(null)}
								>
									{t('runner.backToList')}
								</DesktopAppButton>
							</DesktopAppPanel>
						</DesktopProductWorkspace>
					</DesktopAppContentWrapper>
				);
			}
			return (
				<DesktopAppContentWrapper>
					<DesktopProductWorkspace
						header={
							<div className="px-4 pt-4">
								<h1 className={DESKTOP_TYPOGRAPHY.title}>
									{detailQ.data.title}
								</h1>
								<p className={cn('mt-1', DESKTOP_TYPOGRAPHY.meta)}>
									{t('history.readOnlyHint')}
								</p>
							</div>
						}
					>
						<SurveyRunner
							survey={detailQ.data}
							readOnly
							initialAnswers={activeCompletedRespQ.data.answers}
							onCancel={() => setActiveId(null)}
							onDone={() => setActiveId(null)}
						/>
					</DesktopProductWorkspace>
				</DesktopAppContentWrapper>
			);
		}

		return (
			<DesktopAppContentWrapper>
				<DesktopProductWorkspace
					header={
						<div className="px-4 pt-4">
							<h1 className={DESKTOP_TYPOGRAPHY.title}>{detailQ.data.title}</h1>
						</div>
					}
				>
					<SurveyRunner
						survey={detailQ.data}
						readOnly={detailQ.data.completed}
						onCancel={() => setActiveId(null)}
						onDone={async () => {
							setActiveId(null);
							await invalidateAll();
						}}
					/>
				</DesktopProductWorkspace>
			</DesktopAppContentWrapper>
		);
	}

	if (historyId && (historyDetailQ.isLoading || historyRespQ.isLoading)) {
		return (
			<DesktopAppContentWrapper>
				<DesktopProductWorkspace>
					<DesktopAppPanel className="m-4 p-6">
						<DesktopAppSkeleton className="h-40 w-full" />
					</DesktopAppPanel>
				</DesktopProductWorkspace>
			</DesktopAppContentWrapper>
		);
	}

	if (historyId && historyDetailQ.isError) {
		return (
			<DesktopAppContentWrapper>
				<DesktopProductWorkspace>
					<DesktopAppPanel className="m-4 flex flex-col gap-4 p-6">
						<DesktopAppErrorState
							message={t('errors.surveyLoadFailed')}
							actionLabel={t('errors.retry')}
							onAction={() => void historyDetailQ.refetch()}
						/>
						<DesktopAppButton
							type="button"
							variant="neutral"
							onClick={() => setHistoryId(null)}
						>
							{t('runner.backToList')}
						</DesktopAppButton>
					</DesktopAppPanel>
				</DesktopProductWorkspace>
			</DesktopAppContentWrapper>
		);
	}

	if (historyId && historyDetailQ.data && historyRespQ.data) {
		return (
			<DesktopAppContentWrapper>
				<DesktopProductWorkspace
					header={
						<div className="px-4 pt-4">
							<h1 className={DESKTOP_TYPOGRAPHY.title}>
								{historyDetailQ.data.title}
							</h1>
							<p className={cn('mt-1', DESKTOP_TYPOGRAPHY.meta)}>
								{t('history.readOnlyHint')}
							</p>
						</div>
					}
				>
					<SurveyRunner
						survey={historyDetailQ.data}
						readOnly
						initialAnswers={historyRespQ.data.answers}
						onCancel={() => setHistoryId(null)}
						onDone={() => setHistoryId(null)}
					/>
				</DesktopProductWorkspace>
			</DesktopAppContentWrapper>
		);
	}

	const renderList = (
		items: SurveyUserListItem[],
		emptyKey: string,
		emptyHintKey: string,
		ctaKey: string,
		completed: boolean
	) => {
		if (!items.length) {
			return (
				<DesktopAppEmptyState
					className="min-h-48 rounded-(--desktop-radius-lg) border border-dashed border-(--desktop-border-subtle) bg-(--desktop-surface-soft)"
					icon={
						completed ? (
							<CheckBadgeIcon
								className="h-8 w-8 text-(--desktop-text-muted)"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						) : (
							<ClipboardDocumentListIcon
								className="h-8 w-8 text-(--desktop-text-muted)"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						)
					}
					title={t(emptyKey)}
					description={t(emptyHintKey)}
				/>
			);
		}
		return (
			<ul className="grid gap-3 md:grid-cols-2">
				{items.map((item) => (
					<li key={item.id}>
						<article
							className={cn(
								SH_SURVEY_CARD_CLASS,
								completed && SH_SURVEY_CARD_COMPLETED_CLASS,
								!completed &&
									item.closes_at &&
									surveyClosesSoon(item.closes_at) &&
									SH_SURVEY_CARD_URGENT_CLASS
							)}
						>
							<div className="flex items-start justify-between gap-2">
								<DesktopAppSectionLabel className="line-clamp-2">
									{item.title}
								</DesktopAppSectionLabel>
								<div className="flex shrink-0 flex-col items-end gap-1">
									<span
										className={cn(
											DESKTOP_TYPOGRAPHY.caption,
											'rounded-full border border-(--desktop-border-subtle) px-2 py-0.5 text-(--desktop-text-muted)'
										)}
									>
										{t('list.meta', {
											count: item.question_count,
											minutes: estimateSurveyMinutes(item.question_count),
										})}
									</span>
									{!completed && item.closes_at ? (
										<span
											className={cn(
												DESKTOP_TYPOGRAPHY.caption,
												'rounded-full border px-2 py-0.5',
												surveyClosesSoon(item.closes_at)
													? 'border-amber-500/40 text-amber-200'
													: 'border-(--desktop-border-subtle) text-(--desktop-text-muted)'
											)}
										>
											{t('list.closesAt', {
												date: formatSurveyDateLabel(item.closes_at),
											})}
										</span>
									) : null}
									{completed && item.completed_at ? (
										<span
											className={cn(
												DESKTOP_TYPOGRAPHY.caption,
												'text-(--desktop-text-muted)'
											)}
										>
											{t('list.completedAt', {
												date: formatSurveyDateLabel(item.completed_at),
											})}
										</span>
									) : null}
								</div>
							</div>
							<p className={cn('line-clamp-2', DESKTOP_TYPOGRAPHY.meta)}>
								{item.description_user}
							</p>
							<RewardBadges reward={item.reward} />
							<DesktopAppButton
								type="button"
								variant={completed ? 'neutral' : 'accent'}
								className="mt-auto w-fit"
								onClick={() => openSurvey(item)}
							>
								{t(item.completed ? 'list.viewAnswers' : ctaKey)}
							</DesktopAppButton>
						</article>
					</li>
				))}
			</ul>
		);
	};

	return (
		<DesktopAppContentWrapper>
			<DesktopProductWorkspace header={hero} contentClassName="space-y-8 p-4">
				{nextSurvey ? (
					<DesktopProductNextAction
						title={nextSurvey.title}
						description={
							<>
								{nextSurvey.description_user ? (
									<p className="mb-2">{nextSurvey.description_user}</p>
								) : null}
								<p className={DESKTOP_TYPOGRAPHY.meta}>
									{t('list.meta', {
										count: nextSurvey.question_count,
										minutes: estimateSurveyMinutes(nextSurvey.question_count),
									})}
								</p>
								{surveyHasReward(nextSurvey.reward) ? (
									<div className="mt-2">
										<RewardBadges reward={nextSurvey.reward} />
									</div>
								) : null}
							</>
						}
						actions={
							<DesktopAppButton
								type="button"
								variant="accent"
								onClick={() => openSurvey(nextSurvey)}
							>
								{t('list.start')}
							</DesktopAppButton>
						}
					/>
				) : !availableQ.isLoading &&
					(availableQ.data?.items.length ?? 0) === 0 &&
					(completedQ.data?.items.length ?? 0) > 0 ? (
					<DesktopAppPanel className="border border-[rgb(var(--desktop-accent-rgb)/0.22)] bg-[rgb(var(--desktop-accent-rgb)/0.08)] p-4">
						<p className={DESKTOP_TYPOGRAPHY.subtitle}>
							{t('empty.allCaughtUpTitle')}
						</p>
						<p className={cn('mt-2', DESKTOP_TYPOGRAPHY.meta)}>
							{t('empty.allCaughtUpHint')}
						</p>
					</DesktopAppPanel>
				) : null}

				{listLoadError ? (
					<DesktopAppErrorState
						message={t('errors.loadFailed')}
						actionLabel={t('errors.retry')}
						onAction={() => {
							void availableQ.refetch();
							void completedQ.refetch();
						}}
					/>
				) : null}

				<section className={SH_SECTION_STACK_CLASS}>
					<div className="flex items-center justify-between gap-2">
						<h2 className={DESKTOP_TYPOGRAPHY.subtitle}>
							{t('sections.available')}
						</h2>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							aria-label={t('errors.retry')}
							onClick={() => void invalidateAll()}
						>
							<ArrowPathIcon
								className="h-4 w-4"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						</DesktopAppButton>
					</div>
					{availableQ.isLoading ? (
						<SurveyListSkeleton />
					) : (
						renderList(
							sortedAvailable,
							'empty.available',
							'empty.availableHint',
							'list.start',
							false
						)
					)}
				</section>

				<section className={cn(SH_SECTION_STACK_CLASS, 'mt-8')}>
					<div className="flex flex-wrap items-end justify-between gap-3">
						<h2 className={DESKTOP_TYPOGRAPHY.subtitle}>
							{t('sections.history')}
						</h2>
						<div className="flex min-w-0 flex-1 flex-wrap items-end justify-end gap-2 sm:max-w-lg">
							<label className="min-w-48 flex-1 space-y-1 sm:max-w-xs">
								<span className={DESKTOP_TYPOGRAPHY.caption}>
									{t('history.search')}
								</span>
								<input
									type="search"
									value={historyQuery}
									placeholder={t('history.searchPlaceholder')}
									className={cn(
										'w-full rounded-(--desktop-radius) border border-(--desktop-border-subtle)',
										'bg-(--desktop-surface-soft) px-3 py-2 text-sm text-(--desktop-text-primary)',
										'placeholder:text-(--desktop-text-dim)',
										'focus:border-[rgb(var(--desktop-accent-rgb)/0.45)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--desktop-accent-rgb)/0.2)]'
									)}
									onChange={(e) => {
										const next = e.target.value;
										setHistoryQuery(next);
										persistHistorySearchQuery(next);
									}}
								/>
							</label>
							<DesktopAppButton
								type="button"
								size="sm"
								variant="ghost"
								className="gap-1.5"
								aria-pressed={historyNewestFirst}
								aria-label={
									historyNewestFirst
										? t('history.sortNewestAria')
										: t('history.sortOldestAria')
								}
								onClick={() => {
									setHistoryNewestFirst((prev) => {
										const next = !prev;
										persistHistoryNewestFirst(next);
										return next;
									});
								}}
							>
								{historyNewestFirst ? (
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
								{historyNewestFirst
									? t('history.sortNewest')
									: t('history.sortOldest')}
							</DesktopAppButton>
						</div>
					</div>
					{historyFiltersActive ? (
						<div className="flex flex-wrap items-center justify-end gap-2">
							<p className={cn('flex-1', DESKTOP_TYPOGRAPHY.meta)}>
								{t('history.filtersActiveHint')}
							</p>
							<DesktopAppButton
								type="button"
								size="sm"
								variant="neutral"
								aria-label={t('history.resetFiltersAria')}
								onClick={resetHistoryFilters}
							>
								{t('history.resetFilters')}
							</DesktopAppButton>
						</div>
					) : null}
					{completedQ.isLoading ? (
						<SurveyListSkeleton />
					) : (
						renderList(
							filteredHistory,
							historyQuery ? 'empty.historySearch' : 'empty.history',
							historyQuery ? 'empty.historySearchHint' : 'empty.historyHint',
							'list.start',
							true
						)
					)}
				</section>
			</DesktopProductWorkspace>
		</DesktopAppContentWrapper>
	);
}
