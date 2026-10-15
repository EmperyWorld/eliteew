import type {
	MutationLike,
	QueryLike,
} from '../marketingCabinetPage/marketingCabinetComposeHosts';
import { VirtualVariableList } from '@/components/shared/VirtualList';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	ArrowTopRightOnSquareIcon,
	BeakerIcon,
	ClipboardDocumentIcon,
	CpuChipIcon,
	MagnifyingGlassIcon,
	NewspaperIcon,
	PaintBrushIcon,
	RectangleStackIcon,
	Squares2X2Icon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppErrorState,
	DesktopAppInput,
	DesktopAppSurface,
} from '../../Desktop/components/DesktopAppChrome';
import { DocumentAutofillAction } from '../components/DocumentAutofillAction';
import { MarketingSectionGenerateAiButton } from '../components/MarketingSectionGenerateAiButton';
import { EmptyProjectState } from '../components/EmptyProjectState';
import { FieldLabel } from '../components/FieldLabel';
import { LoadingGrid } from '../components/LoadingGrid';
import { MarketingCabinetSelect } from '../components/MarketingCabinetSelect';
import { MarketingEntityCard } from '../components/MarketingEntityCard';
import { SectionPanel } from '../components/SectionPanel';
import { TokenList } from '../components/TokenList';
import {
	marketingCabinetProjectDashboardInvalidationQueryKey,
	marketingCabinetProjectSectionInvalidationQueryKey,
} from '../marketingCabinetQueryOptions';

import {
	INPUT_STACK_CLASS,
	MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD,
	TEXTAREA_CLASS,
} from '../constants';
import {
	formatDateTime,
	localizePriority,
	localizeResearchTypeSafe,
	localizeStatus,
} from '../locales';
import {
	MC_OPS_RESEARCH_PRIORITY,
	MC_OPS_RESEARCH_STATUS,
	MC_OPS_RESEARCH_TYPE,
} from '../operationsDeepLink';
import type {
	MarketingAiRunDetailResponse,
	MarketingContentItem,
	MarketingListResponse,
	MarketingResearch,
} from '../marketingCabinetApi';

/** Согласовано с `deleteModal` в `MarketingCabinetPage`. */
export type MarketingCabinetDeleteModalTarget = {
	type:
		| 'company'
		| 'project'
		| 'job'
		| 'valueProp'
		| 'competitor'
		| 'research'
		| 'swot';
	id: string;
	name: string;
};

function useEvidenceListViewportHeight(maxPx = 400, vhFraction = 0.48) {
	const [height, setHeight] = useState(maxPx);
	useEffect(() => {
		const update = () => {
			if (typeof window === 'undefined') return;
			setHeight(
				Math.min(
					maxPx,
					Math.max(220, Math.round(window.innerHeight * vhFraction))
				)
			);
		};
		update();
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	}, [maxPx, vhFraction]);
	return height;
}

interface EvidenceResearchCardProps {
	research: MarketingResearch;
	focusedEntityId: string | null;
	researchSynthBusy: boolean;
	researchAiRunTargetId: string | null;
	onStartResearchAiSynthesis?: (researchId: string) => void;
	onCopyResearchCard?: (research: MarketingResearch) => void;
	setDeleteModal: React.Dispatch<
		React.SetStateAction<MarketingCabinetDeleteModalTarget | null>
	>;
}

function EvidenceResearchCard({
	research,
	focusedEntityId,
	researchSynthBusy,
	researchAiRunTargetId,
	onStartResearchAiSynthesis,
	onCopyResearchCard,
	setDeleteModal,
}: EvidenceResearchCardProps) {
	const { t } = useTranslation('marketing');
	const isFocused = focusedEntityId === research.id;

	return (
		<MarketingEntityCard
			helpBlockId="evidence.research_list"
			className={`min-w-0 space-y-2 p-3 sm:space-y-3 sm:p-4 ${isFocused ? 'ring-1 ring-(--mc-accent-55)' : ''}`}
			data-marketing-entity-id={research.id}
		>
			<div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
				<div className="min-w-0 flex-1 space-y-1">
					<div className="wrap-break-word text-sm font-medium text-(--desktop-text-primary)">
						{research.title}
					</div>
					<div className={cn(DESKTOP_TYPOGRAPHY.meta, 'wrap-break-word')}>
						{localizeResearchTypeSafe(research.research_type)} ·{' '}
						{localizePriority(research.priority)} ·{' '}
						{localizeStatus(research.status)}
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
					{onStartResearchAiSynthesis ? (
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="icon"
							onClick={() => onStartResearchAiSynthesis(research.id)}
							disabled={
								researchSynthBusy || !(research.research_query || '').trim()
							}
							aria-label={t('evidenceView.aiSynthesisAria', {
								title: research.title,
							})}
							title={t('evidenceView.aiSynthesisTitle')}
						>
							{researchAiRunTargetId === research.id && researchSynthBusy ? (
								<ArrowPathIcon
									className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							) : (
								<CpuChipIcon
									className="h-4 w-4"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							)}
						</DesktopAppButton>
					) : null}
					{onCopyResearchCard ? (
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="icon"
							onClick={() => onCopyResearchCard(research)}
							aria-label={t('evidenceView.copyResearchCardAria')}
						>
							<ClipboardDocumentIcon
								className="h-4 w-4"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						</DesktopAppButton>
					) : null}
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="icon"
						onClick={() =>
							setDeleteModal({
								type: 'research',
								id: research.id,
								name: research.title ?? '',
							})
						}
						aria-label={t('evidenceView.deleteResearchAria', {
							title: research.title,
						})}
					>
						<TrashIcon
							className="h-4 w-4"
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					</DesktopAppButton>
				</div>
			</div>
			<p className="wrap-break-word text-sm leading-snug text-(--desktop-text-secondary) sm:leading-6">
				{research.research_query || t('evidenceView.queryNotSet')}
			</p>
			{research.result_summary ? (
				<div className="max-h-36 overflow-y-auto rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-2.5 text-xs leading-5 text-(--desktop-text-secondary) sm:max-h-40 sm:p-3">
					{research.result_summary}
				</div>
			) : null}
			<TokenList
				items={research.goals ?? []}
				emptyText={t('evidenceView.goalsEmpty')}
			/>
			{research.result_content_id ? (
				<div className={cn(DESKTOP_TYPOGRAPHY.meta, 'break-all')}>
					{t('evidenceView.resultContentIdLabel', {
						id: research.result_content_id,
					})}
				</div>
			) : null}
		</MarketingEntityCard>
	);
}

interface ResearchFormState {
	title: string;
	research_type: string;
	priority: string;
	research_query: string;
	description: string;
	goals: string;
	result_summary: string;
	status: string;
}

interface ResearchTypeOption {
	id: string;
	label: string;
}

export interface EvidenceViewProps {
	selectedProjectId: string | null;
	researchSearch: string;
	setResearchSearch: (v: string) => void;
	debouncedResearchSearch: string;
	filteredResearches: MarketingResearch[];
	researches: MarketingResearch[];
	researchesQuery: QueryLike<MarketingListResponse<MarketingResearch>>;
	researchForm: ResearchFormState;
	setResearchForm: React.Dispatch<React.SetStateAction<ResearchFormState>>;
	createResearchMutation: MutationLike;
	onCreateResearch: (e: React.FormEvent) => void;
	onExportResearches: () => void;
	/** CSV с полными брифами — только руководитель проекта (created_by). */
	canExportResearches?: boolean;
	onCopyResearches?: () => void;
	setDeleteModal: React.Dispatch<
		React.SetStateAction<MarketingCabinetDeleteModalTarget | null>
	>;
	contentQuery: QueryLike<MarketingListResponse<MarketingContentItem>>;
	contentItems: MarketingContentItem[];
	onOpenContentManager: () => void;
	researchTypes: ResearchTypeOption[];
	extractApiErrorMessage: (error: unknown, fallback: string) => string;
	/** AI-синтез брифа через UGS (async + poll), без долгого HTTP. */
	onStartResearchAiSynthesis?: (researchId: string) => void;
	researchAiRunTargetId?: string | null;
	researchAiRunPollId?: string | null;
	researchAiRunStarting?: boolean;
	researchAiRunDetail?: MarketingAiRunDetailResponse | null;
	/** Подсветка/прокрутка к карточке (например из центра AI-задач). */
	focusedEntityId?: string | null;
	/** Копирование текста одного брифа (уведомление — на странице кабинета). */
	onCopyResearchCard?: (research: MarketingResearch) => void;
	/** Переход в раздел ИМК (если модуль включён для проекта). */
	onOpenImcResearch?: () => void;
	allowMarketingWrite?: boolean;
	selectedCompanyId?: string | null;
	/** Bump parent list when URL filter params change (dashboard deep link). */
	onResearchListFiltersUrlChange?: () => void;
}

export function EvidenceView({
	selectedProjectId,
	researchSearch,
	setResearchSearch,
	debouncedResearchSearch,
	filteredResearches,
	researches,
	researchesQuery,
	researchForm,
	setResearchForm,
	createResearchMutation,
	onCreateResearch,
	onExportResearches,
	canExportResearches = false,
	onCopyResearches,
	setDeleteModal,
	contentQuery,
	contentItems,
	onOpenContentManager,
	researchTypes,
	extractApiErrorMessage,
	onStartResearchAiSynthesis,
	researchAiRunTargetId = null,
	researchAiRunPollId = null,
	researchAiRunStarting = false,
	researchAiRunDetail,
	focusedEntityId = null,
	onCopyResearchCard,
	onOpenImcResearch,
	allowMarketingWrite = true,
	selectedCompanyId = null,
	onResearchListFiltersUrlChange,
}: EvidenceViewProps) {
	const { t } = useTranslation('marketing');
	const researchesDbTotal = researchesQuery.data?.total ?? researches.length;
	const researchesFetchTruncated = researchesDbTotal > researches.length;
	const contentDbTotal = contentQuery.data?.total ?? contentItems.length;
	const contentFetchTruncated = contentDbTotal > contentItems.length;
	const researchListViewportHeight = useEvidenceListViewportHeight(400, 0.48);
	const researchSynthBusy =
		Boolean(researchAiRunPollId) || Boolean(researchAiRunStarting);

	const researchTypeFallbackOptions = useMemo(
		() =>
			(
				[
					'market',
					'customer',
					'competitive',
					'product',
					'swot',
					'jtbd',
					'value_proposition',
					'trend_analysis',
					'custom',
				] as const
			).map((id) => ({
				value: id,
				label: t(`enums.researchType.${id}`),
			})),
		[t]
	);

	const prioritySelectOptions = useMemo(
		() =>
			(['low', 'normal', 'high', 'urgent'] as const).map((value) => ({
				value,
				label: t(`enums.priority.${value}`),
			})),
		[t]
	);

	const researchStatusSelectOptions = useMemo(
		() =>
			(
				[
					'draft',
					'queued',
					'processing',
					'completed',
					'failed',
					'cancelled',
				] as const
			).map((value) => ({
				value,
				label: t(`enums.status.${value}`),
			})),
		[t]
	);

	const [researchFilterUrlTick, setResearchFilterUrlTick] = useState(0);
	useLayoutEffect(() => {
		setResearchFilterUrlTick((n) => n + 1);
	}, []);
	useEffect(() => {
		const onPop = () => setResearchFilterUrlTick((n) => n + 1);
		window.addEventListener('popstate', onPop);
		return () => window.removeEventListener('popstate', onPop);
	}, []);

	const dashboardResearchFilters = useMemo(() => {
		void researchFilterUrlTick;
		if (typeof window === 'undefined') {
			return { status: '', research_type: '', priority: '' };
		}
		const p = new URLSearchParams(window.location.search);
		return {
			status: p.get(MC_OPS_RESEARCH_STATUS)?.trim() ?? '',
			research_type: p.get(MC_OPS_RESEARCH_TYPE)?.trim() ?? '',
			priority: p.get(MC_OPS_RESEARCH_PRIORITY)?.trim() ?? '',
		};
	}, [researchFilterUrlTick]);

	const researchTypeFilterOptions = useMemo(() => {
		const fromCatalog = researchTypes.map((x) => ({
			value: x.id,
			label: x.label,
		}));
		const ids = new Set(fromCatalog.map((o) => o.value));
		for (const r of researches) {
			const id = (r.research_type || '').trim();
			if (id && !ids.has(id)) {
				ids.add(id);
				fromCatalog.push({
					value: id,
					label: localizeResearchTypeSafe(id),
				});
			}
		}
		return [
			{ value: '', label: t('overview.dashboard.listFilter.all') },
			...fromCatalog.sort((a, b) => a.label.localeCompare(b.label)),
		];
	}, [researchTypes, researches, t]);

	const setResearchUrlFilter = React.useCallback(
		(key: string, value: string) => {
			if (typeof window === 'undefined') return;
			const url = new URL(window.location.href);
			const v = value.trim();
			if (v) url.searchParams.set(key, v);
			else url.searchParams.delete(key);
			window.history.replaceState({}, '', url.toString());
			setResearchFilterUrlTick((n) => n + 1);
			onResearchListFiltersUrlChange?.();
		},
		[onResearchListFiltersUrlChange]
	);

	useEffect(() => {
		if (!focusedEntityId) return;
		const element = document.querySelector(
			`[data-marketing-entity-id="${focusedEntityId}"]`
		);
		if (element instanceof HTMLElement) {
			element.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}, [focusedEntityId]);
	const researchAiStatusBlock =
		researchAiRunPollId != null ? (
			<DesktopAppSurface
				variant="soft"
				className="mb-2 space-y-1 p-2.5 sm:mb-3 sm:p-3"
			>
				<div className="text-sm text-(--desktop-text-secondary)">
					{t('evidenceView.aiRunStatusPrefix')}{' '}
					{localizeStatus(
						researchAiRunDetail?.queue?.status ||
							researchAiRunDetail?.run.status ||
							'processing'
					)}
				</div>
				<div className={DESKTOP_TYPOGRAPHY.meta}>
					{t('evidenceView.aiRunQueueLine', {
						waiting: researchAiRunDetail?.queue?.waiting_count ?? '...',
						processing: researchAiRunDetail?.queue?.processing_count ?? '...',
					})}
				</div>
			</DesktopAppSurface>
		) : null;

	if (!selectedProjectId) {
		return (
			<EmptyProjectState
				title={t('evidenceView.emptyProjectTitle')}
				description={t('evidenceView.emptyProjectDescription')}
			/>
		);
	}

	return (
		<div className="grid min-w-0 gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
			<div className="grid min-w-0 gap-3 sm:gap-4">
				<SectionPanel
					title={t('evidenceView.researchPanelTitle')}
					description={t('evidenceView.researchPanelDescription')}
					helpBlockId="evidence.research_list"
					actions={
						<div className="flex w-full min-w-0 flex-wrap items-center gap-2">
							<div className="flex min-w-0 flex-[1_1_100%] items-center gap-1.5 sm:flex-[1_1_auto] sm:max-w-md">
								<DesktopAppInput
									placeholder={t('evidenceView.searchPlaceholder')}
									value={researchSearch}
									onChange={(e) => setResearchSearch(e.target.value)}
									aria-label={t('evidenceView.searchAriaLabel')}
									className="min-w-0 flex-1 sm:max-w-56"
								/>
								{researchSearch.trim() ? (
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										className="shrink-0"
										onClick={() => setResearchSearch('')}
										aria-label={t('evidenceView.clearSearchAria')}
									>
										<PaintBrushIcon
											className="h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
									</DesktopAppButton>
								) : null}
							</div>
							<div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
								{filteredResearches.length > 0 ? (
									<>
										{onCopyResearches ? (
											<DesktopAppButton
												type="button"
												variant="ghost"
												size="sm"
												className="shrink-0"
												onClick={onCopyResearches}
												aria-label={t('evidenceView.copyAllAria')}
											>
												<ClipboardDocumentIcon
													className="h-4 w-4 shrink-0"
													strokeWidth={DESKTOP_LUCIDE.stroke}
												/>
												<span className="max-sm:sr-only">
													{t('evidenceView.copyButton')}
												</span>
											</DesktopAppButton>
										) : null}
										{canExportResearches ? (
											<DesktopAppButton
												type="button"
												variant="ghost"
												size="sm"
												className="shrink-0"
												onClick={onExportResearches}
												aria-label={t('evidenceView.exportCsvAria')}
											>
												<ArrowDownTrayIcon
													className="h-4 w-4 shrink-0"
													strokeWidth={DESKTOP_LUCIDE.stroke}
												/>
												<span className="max-sm:sr-only">
													{t('evidenceView.csvButton')}
												</span>
											</DesktopAppButton>
										) : null}
									</>
								) : null}
								{allowMarketingWrite ? (
									<MarketingSectionGenerateAiButton
										projectId={selectedProjectId}
										companyId={selectedCompanyId}
										targetSection="researches"
										allowMarketingWrite={allowMarketingWrite}
										invalidateQueryKeys={[
											marketingCabinetProjectSectionInvalidationQueryKey(
												'researches',
												selectedProjectId
											),
											marketingCabinetProjectDashboardInvalidationQueryKey(
												selectedProjectId
											),
										]}
									/>
								) : null}
								<DocumentAutofillAction
									projectId={selectedProjectId}
									targetSection="researches"
									targetLabel={t('evidenceView.docAutofillLabel')}
									invalidateQueryKeys={[
										marketingCabinetProjectSectionInvalidationQueryKey(
											'researches',
											selectedProjectId
										),
										marketingCabinetProjectDashboardInvalidationQueryKey(
											selectedProjectId
										),
									]}
								/>
								{onOpenImcResearch ? (
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										className="shrink-0 gap-1"
										onClick={onOpenImcResearch}
										aria-label={t('evidenceView.openImcAria')}
										title={t('evidenceView.openImcTitle')}
									>
										<BeakerIcon
											className="h-3.5 w-3.5 shrink-0"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
										<span className="max-w-36 truncate sm:max-w-none">
											{t('evidenceView.openImc')}
										</span>
									</DesktopAppButton>
								) : null}
							</div>
						</div>
					}
				>
					{researchAiStatusBlock}
					{researchesQuery.isSuccess && researches.length > 0 ? (
						<div className="mb-2 flex flex-wrap gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle)/80 bg-(--desktop-surface-soft)/40 p-2 sm:mb-3">
							<div className="min-w-36 flex-1">
								<MarketingCabinetSelect
									size="compact"
									value={dashboardResearchFilters.status}
									aria-label={t(
										'overview.dashboard.listFilter.researchStatusAria'
									)}
									options={[
										{
											value: '',
											label: t('overview.dashboard.listFilter.all'),
										},
										...researchStatusSelectOptions,
									]}
									onChange={(v) =>
										setResearchUrlFilter(MC_OPS_RESEARCH_STATUS, v)
									}
								/>
							</div>
							<div className="min-w-36 flex-1">
								<MarketingCabinetSelect
									size="compact"
									value={dashboardResearchFilters.research_type}
									aria-label={t(
										'overview.dashboard.listFilter.researchTypeAria'
									)}
									options={researchTypeFilterOptions}
									onChange={(v) =>
										setResearchUrlFilter(MC_OPS_RESEARCH_TYPE, v)
									}
								/>
							</div>
							<div className="min-w-36 flex-1">
								<MarketingCabinetSelect
									size="compact"
									value={dashboardResearchFilters.priority}
									aria-label={t(
										'overview.dashboard.listFilter.researchPriorityAria'
									)}
									options={[
										{
											value: '',
											label: t('overview.dashboard.listFilter.all'),
										},
										...prioritySelectOptions,
									]}
									onChange={(v) =>
										setResearchUrlFilter(MC_OPS_RESEARCH_PRIORITY, v)
									}
								/>
							</div>
						</div>
					) : null}
					{researchesQuery.isLoading ? (
						<LoadingGrid />
					) : researchesQuery.isError ? (
						<DesktopAppErrorState
							message={extractApiErrorMessage(
								researchesQuery.error,
								t('evidenceView.loadResearchesError')
							)}
							onAction={() => void researchesQuery.refetch()}
						/>
					) : filteredResearches.length > 0 ? (
						filteredResearches.length >
						MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD ? (
							<div className="min-w-0 space-y-2">
								<div
									className={cn(DESKTOP_TYPOGRAPHY.meta, 'wrap-break-word')}
									aria-live="polite"
								>
									{researches.length > filteredResearches.length
										? t('evidenceView.researchListSummaryPartial', {
												shown: filteredResearches.length,
												total: researches.length,
											})
										: researchesFetchTruncated
											? t('cabinetPage.listFetchSummaryTruncated', {
													shown: researches.length,
													total: researchesDbTotal,
												})
											: t('evidenceView.researchListSummaryAll', {
													count: filteredResearches.length,
												})}
								</div>
								<div className="min-w-0 max-w-full rounded-(--desktop-radius) border border-(--desktop-border-subtle)">
									<VirtualVariableList
										items={filteredResearches}
										getItemKey={(index) =>
											filteredResearches[index]?.id ?? index
										}
										estimateSize={() => 152}
										height={researchListViewportHeight}
										overscanCount={5}
										className="rounded-(--desktop-radius) border-0"
										renderItem={(research) => (
											<div className="pb-2 sm:pb-3">
												<EvidenceResearchCard
													research={research}
													focusedEntityId={focusedEntityId}
													researchSynthBusy={researchSynthBusy}
													researchAiRunTargetId={researchAiRunTargetId}
													onStartResearchAiSynthesis={
														onStartResearchAiSynthesis
													}
													onCopyResearchCard={onCopyResearchCard}
													setDeleteModal={setDeleteModal}
												/>
											</div>
										)}
									/>
								</div>
							</div>
						) : (
							<div className="min-w-0 space-y-2 sm:space-y-3">
								{researches.length > filteredResearches.length ||
								researchesFetchTruncated ? (
									<div
										className={cn(DESKTOP_TYPOGRAPHY.meta, 'wrap-break-word')}
										aria-live="polite"
									>
										{researches.length > filteredResearches.length
											? t('evidenceView.researchListSummaryPartial', {
													shown: filteredResearches.length,
													total: researches.length,
												})
											: t('cabinetPage.listFetchSummaryTruncated', {
													shown: researches.length,
													total: researchesDbTotal,
												})}
									</div>
								) : null}
								<ul
									className="min-w-0 list-none space-y-2 p-0 sm:space-y-3"
									aria-label={t('evidenceView.researchPanelTitle')}
								>
									{filteredResearches.map((research) => (
										<li key={research.id} className="min-w-0">
											<EvidenceResearchCard
												research={research}
												focusedEntityId={focusedEntityId}
												researchSynthBusy={researchSynthBusy}
												researchAiRunTargetId={researchAiRunTargetId}
												onStartResearchAiSynthesis={onStartResearchAiSynthesis}
												onCopyResearchCard={onCopyResearchCard}
												setDeleteModal={setDeleteModal}
											/>
										</li>
									))}
								</ul>
							</div>
						)
					) : researches.length > 0 ? (
						<DesktopAppEmptyState
							role="status"
							aria-live="polite"
							className="gap-3 px-4 py-8 sm:px-8 sm:py-10"
							icon={
								<MagnifyingGlassIcon
									className="h-8 w-8 text-(--desktop-text-muted)"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							}
							title={t('evidenceView.searchNoResultsTitle')}
							description={t('evidenceView.searchNoResultsDescription', {
								query: debouncedResearchSearch,
							})}
						/>
					) : (
						<DesktopAppEmptyState
							role="status"
							aria-live="polite"
							className="gap-3 px-4 py-8 sm:px-8 sm:py-10"
							icon={
								<NewspaperIcon
									className="h-8 w-8 text-(--desktop-text-muted)"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							}
							title={t('evidenceView.listEmptyTitle')}
							description={t('evidenceView.listEmptyDescription')}
						/>
					)}
				</SectionPanel>

				<SectionPanel
					title={t('evidenceView.createPanelTitle')}
					description={t('evidenceView.createPanelDescription')}
					helpBlockId="evidence.research_create"
				>
					<form
						className="min-w-0 space-y-2.5 sm:space-y-3"
						onSubmit={onCreateResearch}
					>
						<FieldLabel label={t('evidenceView.fieldTitle')} required>
							<DesktopAppInput
								value={researchForm.title}
								onChange={(event) =>
									setResearchForm((prev) => ({
										...prev,
										title: event.target.value,
									}))
								}
								placeholder={t('evidenceView.placeholderTitle')}
							/>
						</FieldLabel>
						<div className={INPUT_STACK_CLASS}>
							<FieldLabel label={t('evidenceView.fieldType')}>
								<MarketingCabinetSelect
									value={researchForm.research_type}
									onChange={(v) =>
										setResearchForm((prev) => ({ ...prev, research_type: v }))
									}
									options={
										researchTypes.length > 0
											? researchTypes.map((item) => {
													const key = item.id
														.toLowerCase()
														.replace(/\s+/g, '_');
													return {
														value: item.id,
														label: t(`enums.researchType.${key}`, {
															defaultValue: item.label,
														}),
													};
												})
											: researchTypeFallbackOptions
									}
								/>
							</FieldLabel>
							<FieldLabel label={t('evidenceView.fieldPriority')}>
								<MarketingCabinetSelect
									value={researchForm.priority}
									onChange={(v) =>
										setResearchForm((prev) => ({ ...prev, priority: v }))
									}
									options={prioritySelectOptions}
								/>
							</FieldLabel>
						</div>
						<FieldLabel label={t('evidenceView.fieldResearchQuery')} required>
							<textarea
								className={TEXTAREA_CLASS}
								value={researchForm.research_query}
								onChange={(event) =>
									setResearchForm((prev) => ({
										...prev,
										research_query: event.target.value,
									}))
								}
								placeholder={t('evidenceView.placeholderResearchQuery')}
							/>
						</FieldLabel>
						<FieldLabel label={t('evidenceView.fieldDescription')}>
							<textarea
								className={TEXTAREA_CLASS}
								value={researchForm.description}
								onChange={(event) =>
									setResearchForm((prev) => ({
										...prev,
										description: event.target.value,
									}))
								}
								placeholder={t('evidenceView.placeholderDescription')}
							/>
						</FieldLabel>
						<FieldLabel
							label={t('evidenceView.fieldGoals')}
							hint={t('evidenceView.fieldGoalsHint')}
						>
							<textarea
								className={TEXTAREA_CLASS}
								value={researchForm.goals}
								onChange={(event) =>
									setResearchForm((prev) => ({
										...prev,
										goals: event.target.value,
									}))
								}
								placeholder={t('evidenceView.placeholderGoals')}
							/>
						</FieldLabel>
						<FieldLabel label={t('evidenceView.fieldResultSummary')}>
							<textarea
								className={TEXTAREA_CLASS}
								value={researchForm.result_summary}
								onChange={(event) =>
									setResearchForm((prev) => ({
										...prev,
										result_summary: event.target.value,
									}))
								}
								placeholder={t('evidenceView.placeholderResultSummary')}
							/>
						</FieldLabel>
						<FieldLabel label={t('evidenceView.fieldStatus')}>
							<MarketingCabinetSelect
								value={researchForm.status}
								onChange={(v) =>
									setResearchForm((prev) => ({ ...prev, status: v }))
								}
								options={researchStatusSelectOptions}
							/>
						</FieldLabel>
						<DesktopAppButton
							type="submit"
							variant="accent"
							disabled={
								createResearchMutation.isPending ||
								!researchForm.title.trim() ||
								!researchForm.research_query.trim()
							}
						>
							{createResearchMutation.isPending ? (
								<ArrowPathIcon
									className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							) : (
								<BeakerIcon
									className="h-4 w-4"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							)}
							{t('evidenceView.submitCreate')}
						</DesktopAppButton>
					</form>
				</SectionPanel>
			</div>

			<div className="grid min-w-0 gap-3 sm:gap-4">
				<SectionPanel
					title={t('evidenceView.contentPanelTitle')}
					description={t('evidenceView.contentPanelDescription')}
					helpBlockId="evidence.unified_content"
					actions={
						<div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className="min-w-0 shrink"
								onClick={onOpenContentManager}
							>
								<span className="min-w-0 truncate sm:max-w-none">
									{t('evidenceView.openContent')}
								</span>
								<ArrowTopRightOnSquareIcon
									className="h-3.5 w-3.5 shrink-0"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className="shrink-0"
								onClick={() => void contentQuery.refetch()}
								aria-label={t('evidenceView.refreshEvidenceAria')}
							>
								<ArrowPathIcon
									className="h-3.5 w-3.5"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							</DesktopAppButton>
						</div>
					}
				>
					{contentQuery.isLoading ? (
						<LoadingGrid />
					) : contentQuery.isError ? (
						<DesktopAppErrorState
							message={extractApiErrorMessage(
								contentQuery.error,
								t('evidenceView.loadContentError')
							)}
							onAction={() => void contentQuery.refetch()}
						/>
					) : contentItems.length > 0 ? (
						<div className="min-w-0 space-y-2">
							{contentFetchTruncated ? (
								<p className={cn('mc-meta-caption', DESKTOP_TYPOGRAPHY.meta)}>
									{t('cabinetPage.listFetchSummaryTruncated', {
										shown: contentItems.length,
										total: contentDbTotal,
									})}
								</p>
							) : null}
							{contentItems.length >
							MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD ? (
								<VirtualVariableList
									items={contentItems}
									estimateSize={() => 120}
									getItemKey={(index) =>
										contentItems[index]?.id ?? `content-${index}`
									}
									height={360}
									overscanCount={6}
									className="rounded-(--desktop-radius)"
									renderItem={(item: MarketingContentItem) => (
										<div className="pb-2">
											<DesktopAppSurface
												variant="soft"
												className="min-w-0 space-y-1.5 p-3 sm:space-y-2 sm:p-4"
											>
												<div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-2">
													<div className="min-w-0 wrap-break-word text-sm font-medium text-(--desktop-text-primary)">
														{item.name}
													</div>
													<div
														className={cn(
															DESKTOP_TYPOGRAPHY.caption,
															'min-w-0 wrap-break-word sm:max-w-[50%] sm:shrink-0 sm:truncate sm:text-right sm:whitespace-nowrap'
														)}
													>
														{item.content_type} ·{' '}
														{formatDateTime(item.updated_at)}
													</div>
												</div>
												<p className="line-clamp-4 min-w-0 wrap-break-word text-xs leading-5 text-(--desktop-text-secondary) sm:line-clamp-none">
													{item.description?.slice(0, 320) ||
														t('evidenceView.noExtractedText')}
												</p>
											</DesktopAppSurface>
										</div>
									)}
								/>
							) : (
								<ul
									className="min-w-0 list-none space-y-2 p-0 sm:space-y-3"
									aria-label={t('evidenceView.contentPanelTitle')}
								>
									{contentItems.map((item: MarketingContentItem) => (
										<li key={item.id} className="min-w-0">
											<DesktopAppSurface
												variant="soft"
												className="min-w-0 space-y-1.5 p-3 sm:space-y-2 sm:p-4"
											>
												<div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-2">
													<div className="min-w-0 wrap-break-word text-sm font-medium text-(--desktop-text-primary)">
														{item.name}
													</div>
													<div
														className={cn(
															DESKTOP_TYPOGRAPHY.caption,
															'min-w-0 wrap-break-word sm:max-w-[50%] sm:shrink-0 sm:truncate sm:text-right sm:whitespace-nowrap'
														)}
													>
														{item.content_type} ·{' '}
														{formatDateTime(item.updated_at)}
													</div>
												</div>
												<p className="line-clamp-4 min-w-0 wrap-break-word text-xs leading-5 text-(--desktop-text-secondary) sm:line-clamp-none">
													{item.description?.slice(0, 320) ||
														t('evidenceView.noExtractedText')}
												</p>
											</DesktopAppSurface>
										</li>
									))}
								</ul>
							)}
						</div>
					) : (
						<DesktopAppEmptyState
							role="status"
							aria-live="polite"
							className="gap-3 px-4 py-8 sm:px-8 sm:py-10"
							icon={
								<RectangleStackIcon
									className="h-8 w-8 text-(--desktop-text-muted)"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							}
							title={t('evidenceView.contentEmptyTitle')}
							description={t('evidenceView.contentEmptyDescription')}
						/>
					)}
				</SectionPanel>

				<SectionPanel
					title={t('evidenceView.cyclePanelTitle')}
					description={t('evidenceView.cyclePanelDescription')}
					helpBlockId="evidence.cycle_explainer"
				>
					<div className="min-w-0 space-y-2 text-sm leading-snug text-(--desktop-text-secondary) sm:space-y-3 sm:leading-6">
						<div className="flex min-w-0 items-start gap-2.5 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3 sm:gap-3 sm:p-4">
							<NewspaperIcon
								className="mt-0.5 h-4 w-4 shrink-0 text-(--mc-accent)"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
							<span className="min-w-0 wrap-break-word">
								{t('evidenceView.cycleBriefsText')}
							</span>
						</div>
						<div className="flex min-w-0 items-start gap-2.5 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3 sm:gap-3 sm:p-4">
							<Squares2X2Icon
								className="mt-0.5 h-4 w-4 shrink-0 text-(--mc-accent)"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
							<span className="min-w-0 wrap-break-word">
								{t('evidenceView.cycleUnifiedText')}
							</span>
						</div>
						<div className="flex min-w-0 items-start gap-2.5 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3 sm:gap-3 sm:p-4">
							<CpuChipIcon
								className="mt-0.5 h-4 w-4 shrink-0 text-(--mc-accent)"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
							<span className="min-w-0 wrap-break-word">
								{t('evidenceView.cycleChatText')}
							</span>
						</div>
					</div>
				</SectionPanel>
			</div>
		</div>
	);
}
