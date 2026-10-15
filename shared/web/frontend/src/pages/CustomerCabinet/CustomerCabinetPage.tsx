/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Customer-facing cabinet page: companies, accessible projects, and per-project workspace tabs.
 *
 * Invariants:
 * - Project list reflects Marketing Cabinet team membership, not blanket company-wide access.
 *
 * Related:
 * - CustomerProjectWorkspace.tsx, customerCabinetQueryOptions.ts
 */
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppInput,
	DesktopAppListRow,
	DesktopAppSectionLabel,
	DesktopAppSurface,
	DesktopAppToolbar,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { LoadingGrid } from '@/pages/MarketingCabinet/components/LoadingGrid';
import { localizeStatus } from '@/pages/MarketingCabinet/locales';
import { cn } from '@/utils/cn';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import {
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from 'react';
import {
	ArrowPathIcon,
	BuildingOffice2Icon,
	ChevronDownIcon,
	ChevronRightIcon,
	HandRaisedIcon,
	MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import {
	customerCabinetCompaniesQueryOptions,
	customerCabinetProjectsQueryOptions,
	customerCabinetRootInvalidationQueryKey,
	customerCabinetWorkspaceSignalsQueryOptions,
} from './customerCabinetQueryOptions';
import { guideTourLabelsFromI18n } from '@/components/guided-tour/guideTourLabelsFromI18n';
import { SpotlightGuideModal } from '@/components/guided-tour/SpotlightGuideModal';
import { useBuiltGuideSteps } from '@/components/guided-tour/useBuiltGuideSteps';
import { useDesktopGuideTourOpener } from '@/pages/Desktop/hooks/useDesktopGuideTourOpener';
import {
	CUSTOMER_CABINET_GUIDE_AUDIO_LS_KEY,
	CUSTOMER_CABINET_GUIDE_ROOT_ID,
	CUSTOMER_CABINET_GUIDE_STEP_DEFS,
	CUSTOMER_CABINET_GUIDE_TOUR_FOLDER,
} from './customerCabinetGuideConstants';

const CustomerProjectWorkspace = lazy(() =>
	import('./CustomerProjectWorkspace').then((m) => ({
		default: m.CustomerProjectWorkspace,
	}))
);

export const CustomerCabinetPage: React.FC = () => {
	const { t } = useTranslation('customerCabinet');
	const qc = useQueryClient();
	const companiesQuery = useQuery(customerCabinetCompaniesQueryOptions());

	const companies = companiesQuery.data ?? [];
	const [openProjectId, setOpenProjectId] = useState<string | null>(null);
	const [filterQuery, setFilterQuery] = useState('');
	const guideLabels = useMemo(() => guideTourLabelsFromI18n(t, 'guide'), [t]);
	const guideSteps = useBuiltGuideSteps(
		t,
		'guide.steps',
		CUSTOMER_CABINET_GUIDE_STEP_DEFS
	);
	const [guideOpen, setGuideOpen] = useState(false);
	const openGuideTour = useCallback(() => setGuideOpen(true), []);
	useDesktopGuideTourOpener(openGuideTour);

	const projectQueries = useQueries({
		queries: companies.map((c) => ({
			...customerCabinetProjectsQueryOptions(c.id),
			enabled: companiesQuery.isSuccess && companies.length > 0,
		})),
	});

	const flatProjectRows = companies.flatMap((c, idx) =>
		(projectQueries[idx]?.data ?? []).map((project) => ({
			companyId: c.id,
			project,
		}))
	);

	const summaryQueries = useQueries({
		queries: flatProjectRows.map(({ project: p }) => ({
			...customerCabinetWorkspaceSignalsQueryOptions(p.id),
			enabled: companiesQuery.isSuccess && flatProjectRows.length > 0,
		})),
	});

	const summaryFor = (projectId: string) => {
		const idx = flatProjectRows.findIndex((r) => r.project.id === projectId);
		if (idx < 0) return undefined;
		return summaryQueries[idx];
	};

	const filterLower = filterQuery.trim().toLowerCase();

	const visibleCompanies = useMemo(() => {
		const rows = companies.map((c, idx) => {
			const pq = projectQueries[idx];
			const projs = pq?.data ?? [];
			if (!filterLower) {
				return { company: c, idx, projects: projs };
			}
			const companyMatch =
				c.name.toLowerCase().includes(filterLower) ||
				(c.industry ?? '').toLowerCase().includes(filterLower);
			const projects = companyMatch
				? projs
				: projs.filter(
						(p) =>
							p.name.toLowerCase().includes(filterLower) ||
							(p.goals ?? '').toLowerCase().includes(filterLower)
					);
			return { company: c, idx, projects };
		});
		if (!filterLower) return rows;
		return rows.filter(
			(row) =>
				row.projects.length > 0 ||
				row.company.name.toLowerCase().includes(filterLower) ||
				(row.company.industry ?? '').toLowerCase().includes(filterLower)
		);
	}, [companies, filterLower, projectQueries]);

	const firstProjectId = visibleCompanies[0]?.projects[0]?.id ?? null;
	const prepareGuideStep = useCallback(
		(stepId: string) => {
			if (stepId === 'workspace' && firstProjectId) {
				setOpenProjectId(firstProjectId);
			}
			if (stepId === 'project-row' && firstProjectId) {
				setOpenProjectId(null);
			}
		},
		[firstProjectId]
	);

	useEffect(() => {
		if (!openProjectId) return;
		const id = `customer-cabinet-project-${openProjectId}`;
		requestAnimationFrame(() => {
			document.getElementById(id)?.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest',
			});
		});
	}, [openProjectId]);

	const refreshing =
		companiesQuery.isFetching ||
		projectQueries.some((q) => q.isFetching) ||
		summaryQueries.some((q) => q.isFetching);

	const handleRefreshAll = (): void => {
		void qc.invalidateQueries({
			queryKey: customerCabinetRootInvalidationQueryKey(),
		});
	};

	return (
		<div
			id={CUSTOMER_CABINET_GUIDE_ROOT_ID}
			className={cn(
				DESKTOP_APP_STYLE_CONTRACT.shell,
				'relative flex h-full min-h-0 flex-col gap-5 p-6'
			)}
		>
			<header
				data-customer-cabinet-guide="header"
				className="shrink-0 space-y-3"
			>
				<DesktopAppToolbar className="flex flex-wrap items-start justify-between gap-3 border-none p-0">
					<div className="flex min-w-0 flex-wrap items-center gap-2">
						<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-muted)">
							<HandRaisedIcon className="h-5 w-5" aria-hidden />
						</span>
						<div className="min-w-0">
							<h1 className="text-lg font-semibold text-(--desktop-text-primary)">
								{t('title')}
							</h1>
							<p className={cn(DESKTOP_TYPOGRAPHY.meta, 'mt-0.5 max-w-3xl')}>
								{t('subtitle')}
							</p>
						</div>
					</div>
					{companies.length > 0 ? (
						<DesktopAppButton
							type="button"
							variant="neutral"
							size="sm"
							className="shrink-0 gap-1.5"
							disabled={refreshing && !companiesQuery.isLoading}
							onClick={handleRefreshAll}
							aria-label={t('refreshAria')}
							data-customer-cabinet-guide="refresh"
						>
							<ArrowPathIcon
								className={cn('h-3.5 w-3.5', refreshing ? 'animate-spin' : '')}
								aria-hidden
							/>
							{t('refresh')}
						</DesktopAppButton>
					) : null}
				</DesktopAppToolbar>
				{companies.length > 0 ? (
					<div
						data-customer-cabinet-guide="search"
						className="relative max-w-md"
					>
						<MagnifyingGlassIcon
							className="pointer-events-none absolute left-2.5 top-1/2 z-1 h-3.5 w-3.5 -translate-y-1/2 text-(--desktop-text-muted)"
							aria-hidden
						/>
						<DesktopAppInput
							className="pl-8"
							value={filterQuery}
							onChange={(e) => setFilterQuery(e.target.value)}
							placeholder={t('searchPlaceholder')}
							aria-label={t('searchAria')}
							autoComplete="off"
						/>
					</div>
				) : null}
			</header>

			<div className="min-h-0 flex-1 overflow-y-auto">
				{companiesQuery.isLoading ? (
					<div
						className="space-y-4"
						role="status"
						aria-busy="true"
						aria-label={t('loading')}
					>
						<div className="h-4 max-w-40 animate-pulse rounded-md bg-(--desktop-surface-soft)" />
						<div className="space-y-3 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/35 p-4">
							<div className="h-3 max-w-[85%] animate-pulse rounded bg-(--desktop-surface-soft)" />
							<div className="h-3 max-w-[60%] animate-pulse rounded bg-(--desktop-surface-soft)" />
							<div className="h-3 max-w-[40%] animate-pulse rounded bg-(--desktop-surface-soft)" />
						</div>
					</div>
				) : companiesQuery.isError ? (
					<DesktopAppSurface
						variant="soft"
						padding="md"
						className="max-w-lg space-y-3"
					>
						<p className="text-sm text-(--desktop-text-primary)">
							{t('loadError')}
						</p>
						<DesktopAppButton
							type="button"
							variant="accent"
							size="sm"
							className="w-fit"
							onClick={() => void companiesQuery.refetch()}
						>
							{t('loadErrorRetry')}
						</DesktopAppButton>
					</DesktopAppSurface>
				) : companies.length === 0 ? (
					<DesktopAppEmptyState
						title={t('emptyCompanies.title')}
						description={t('emptyCompanies.description')}
						className="max-w-lg"
					/>
				) : visibleCompanies.length === 0 && filterLower ? (
					<DesktopAppEmptyState
						title={t('filterEmpty')}
						description={t('filterEmptyDescription')}
						className="max-w-lg"
					/>
				) : (
					<ul className="space-y-5">
						{visibleCompanies.map(({ company: c, idx, projects: projs }) => {
							const pq = projectQueries[idx];
							return (
								<li key={c.id} data-customer-cabinet-guide="company-tree">
									<DesktopAppSurface
										variant="soft"
										padding="md"
										className="space-y-4"
									>
										<div className="flex flex-wrap items-start gap-3">
											<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel-strong)/60 text-(--desktop-text-muted)">
												<BuildingOffice2Icon className="h-4 w-4" aria-hidden />
											</span>
											<div className="min-w-0 flex-1">
												<p className="font-medium text-(--desktop-text-primary)">
													{c.name}
												</p>
												{c.industry ? (
													<p className={DESKTOP_TYPOGRAPHY.meta}>
														{c.industry}
													</p>
												) : null}
											</div>
										</div>

										<div>
											<DesktopAppSectionLabel className="mb-2">
												{t('projectsSection')}
											</DesktopAppSectionLabel>
											{pq?.isLoading ? (
												<div
													className={cn(
														DESKTOP_TYPOGRAPHY.meta,
														'flex items-center gap-1.5'
													)}
												>
													<ArrowPathIcon
														className="h-3 w-3 animate-spin opacity-70"
														aria-hidden
													/>
													{t('loading')}
												</div>
											) : pq?.isError ? (
												<p className="text-xs text-(--desktop-text-dim)">
													{t('projectsLoadError')}
												</p>
											) : projs.length === 0 ? (
												<p className="text-xs leading-relaxed text-(--desktop-text-dim)">
													{t('projectsEmpty')}
												</p>
											) : (
												<ul className="space-y-2">
													{projs.map((p) => {
														const expanded = openProjectId === p.id;
														const sq = summaryFor(p.id);
														const s = sq?.data;
														const summaryLoading = sq?.isLoading;
														const summaryFailed = sq?.isError;
														const statusLabel = localizeStatus(p.status);
														return (
															<li
																id={`customer-cabinet-project-${p.id}`}
																key={p.id}
																data-customer-cabinet-guide={
																	projs[0]?.id === p.id
																		? 'project-row'
																		: undefined
																}
																className="scroll-mt-4 overflow-hidden rounded-(--desktop-radius) border border-(--desktop-border-subtle)/80 bg-(--desktop-surface-panel)/35"
															>
																<DesktopAppListRow
																	type="button"
																	active={expanded}
																	className="h-auto! w-full flex-col items-stretch gap-2 px-3 py-2.5 text-left sm:flex-row sm:items-center sm:justify-between"
																	onClick={() =>
																		setOpenProjectId(expanded ? null : p.id)
																	}
																	aria-expanded={expanded}
																	aria-controls={`customer-cabinet-panel-${p.id}`}
																	id={`customer-cabinet-trigger-${p.id}`}
																	aria-label={
																		expanded
																			? t('collapseDetails')
																			: t('expandDetails')
																	}
																>
																	<span className="flex min-w-0 flex-1 items-start gap-2 sm:items-center">
																		{expanded ? (
																			<ChevronDownIcon className="mt-0.5 h-4 w-4 shrink-0 opacity-70 sm:mt-0" />
																		) : (
																			<ChevronRightIcon className="mt-0.5 h-4 w-4 shrink-0 opacity-70 sm:mt-0" />
																		)}
																		<span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left sm:flex-row sm:items-baseline sm:gap-2">
																			<span className="truncate font-medium text-(--desktop-text-primary)">
																				{p.name}
																			</span>
																			<span className="shrink-0 text-[11px] text-(--desktop-text-muted)">
																				{statusLabel}
																			</span>
																		</span>
																	</span>
																	<div className="flex shrink-0 flex-wrap items-center gap-1.5 pl-7 sm:justify-end sm:pl-0">
																		{summaryLoading ? (
																			<ArrowPathIcon
																				className="h-3.5 w-3.5 animate-spin text-(--desktop-text-muted)"
																				aria-hidden
																			/>
																		) : summaryFailed ? (
																			<span
																				className="text-[10px] text-(--desktop-text-dim)"
																				title={t('summaryError')}
																			>
																				{t('summaryError')}
																			</span>
																		) : s ? (
																			<>
																				{s.pendingDocs > 0 ? (
																					<span className="inline-flex max-w-full items-center rounded-md border border-amber-500/25 bg-amber-950/35 px-2 py-0.5 text-[10px] font-medium text-amber-200/95">
																						{t('badges.pendingApproval', {
																							count: s.pendingDocs,
																						})}
																					</span>
																				) : null}
																				{s.approvedDocs > 0 ? (
																					<span className="inline-flex max-w-full items-center rounded-md border border-emerald-500/25 bg-emerald-950/30 px-2 py-0.5 text-[10px] font-medium text-emerald-200/95">
																						{t('badges.approved', {
																							count: s.approvedDocs,
																						})}
																					</span>
																				) : null}
																				{s.removalPending > 0 ? (
																					<span className="inline-flex max-w-full items-center rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0.5 text-[10px] text-(--desktop-text-secondary)">
																						{t('badges.removalPending', {
																							count: s.removalPending,
																						})}
																					</span>
																				) : null}
																				{s.presentations > 0 ? (
																					<span className="inline-flex max-w-full items-center rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0.5 text-[10px] text-(--desktop-text-secondary)">
																						{t('badges.presentations', {
																							count: s.presentations,
																						})}
																					</span>
																				) : null}
																			</>
																		) : null}
																	</div>
																</DesktopAppListRow>
																{p.goals ? (
																	<p
																		className="mx-3 mb-1 line-clamp-2 border-b border-transparent px-0 pb-2 text-[11px] leading-snug text-(--desktop-text-dim)"
																		title={p.goals}
																	>
																		<span className="font-medium text-(--desktop-text-muted)">
																			{t('goalsHint')}:{' '}
																		</span>
																		{p.goals}
																	</p>
																) : null}
																{expanded ? (
																	<section
																		data-customer-cabinet-guide="workspace"
																		className="border-t border-(--desktop-border-subtle)/60 px-3 py-3"
																		id={`customer-cabinet-panel-${p.id}`}
																		aria-labelledby={`customer-cabinet-trigger-${p.id}`}
																	>
																		<DesktopAppSectionLabel className="mb-2">
																			{t('interactionSection')}
																		</DesktopAppSectionLabel>
																		<Suspense fallback={<LoadingGrid />}>
																			<CustomerProjectWorkspace
																				projectId={p.id}
																				signals={
																					s
																						? {
																								pendingDocs: s.pendingDocs,
																								presentations: s.presentations,
																							}
																						: null
																				}
																			/>
																		</Suspense>
																	</section>
																) : null}
															</li>
														);
													})}
												</ul>
											)}
										</div>
									</DesktopAppSurface>
								</li>
							);
						})}
					</ul>
				)}
			</div>
			<SpotlightGuideModal
				open={guideOpen}
				onClose={() => setGuideOpen(false)}
				rootId={CUSTOMER_CABINET_GUIDE_ROOT_ID}
				steps={guideSteps}
				audioLocalStorageKey={CUSTOMER_CABINET_GUIDE_AUDIO_LS_KEY}
				tourAudioFolder={CUSTOMER_CABINET_GUIDE_TOUR_FOLDER}
				labels={guideLabels}
				onPrepareStep={prepareGuideStep}
				spotlightLayoutKey={`${guideOpen}-${openProjectId ?? 'none'}`}
				dialogTitleId="customer-cabinet-guide-title"
			/>
		</div>
	);
};

export default CustomerCabinetPage;
