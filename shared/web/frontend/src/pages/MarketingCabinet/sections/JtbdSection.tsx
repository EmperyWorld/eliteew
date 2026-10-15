import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	ClipboardDocumentIcon,
	PaintBrushIcon,
	PencilSquareIcon,
	PlusIcon,
	SparklesIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { VirtualVariableList } from '@/components/shared/VirtualList';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

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
	INPUT_STACK_CLASS,
	MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD,
	TEXTAREA_CLASS,
} from '../constants';
import {
	getJtbdScoreSelectOptions,
	localizeJobCategory,
	localizePriority,
	localizeSource,
	localizeStatus,
} from '../locales';
import type {
	MutationLike,
	QueryLike,
} from '../marketingCabinetPage/marketingCabinetComposeHosts';
import type { JobStoryFormState } from '../marketingCabinetPageTypes';
import type {
	MarketingAiRunDetailResponse,
	MarketingJobStory,
} from '../marketingCabinetApi';
import { extractApiErrorMessage } from '../utils';
import type { MarketingDeleteModalSetter } from './CompaniesSection';
import {
	marketingCabinetProjectDashboardInvalidationQueryKey,
	marketingCabinetProjectSectionInvalidationQueryKey,
} from '../marketingCabinetQueryOptions';

import {
	MC_OPS_JTBD_CATEGORY,
	MC_OPS_JTBD_PRIORITY,
	MC_OPS_JTBD_VALIDATED,
	parseMarketingCabinetOpsListFilters,
} from '../operationsDeepLink';

export interface JtbdSectionProps {
	selectedProjectId: string | null;
	selectedCompanyId: string | null;
	jobStorySearch: string;
	setJobStorySearch: React.Dispatch<React.SetStateAction<string>>;
	debouncedJobStorySearch: string;
	allJobStories: MarketingJobStory[];
	filteredJobStories: MarketingJobStory[];
	jobStoriesQuery: QueryLike<
		import('../marketingCabinetApi').MarketingListResponse<MarketingJobStory>
	>;
	selectedJobStoryIds: string[];
	setSelectedJobStoryIds: React.Dispatch<React.SetStateAction<string[]>>;
	allowMarketingWrite: boolean;
	handleCopyAllJobs: () => void | Promise<void>;
	handleExportJobs: () => void | Promise<void>;
	handleCopySingleJob: (job: MarketingJobStory) => void | Promise<void>;
	setJtbdContextMenu: React.Dispatch<
		React.SetStateAction<{
			x: number;
			y: number;
			job: MarketingJobStory;
		} | null>
	>;
	createJobStoryMutation: MutationLike;
	extractJobStoriesMutation: MutationLike;
	jobStoryForm: JobStoryFormState;
	setJobStoryForm: React.Dispatch<React.SetStateAction<JobStoryFormState>>;
	jobStoryCategorySelectOptions: Array<{ value: string; label: string }>;
	jobStoryPrioritySelectOptions: Array<{ value: string; label: string }>;
	handleCreateJobStory: (event: React.FormEvent) => void;
	handleExtractJobStories: (event: React.FormEvent) => void;
	jobStoryExtractText: string;
	setJobStoryExtractText: React.Dispatch<React.SetStateAction<string>>;
	jobStoryExtractCount: string;
	setJobStoryExtractCount: React.Dispatch<React.SetStateAction<string>>;
	jobStoryExtractRunId: string | null;
	jobStoryExtractRunQuery: QueryLike<MarketingAiRunDetailResponse>;
	setEditingJobStory: React.Dispatch<
		React.SetStateAction<MarketingJobStory | null>
	>;
	setDeleteModal: MarketingDeleteModalSetter;
	/** Инкремент при изменении `mc_ops_jtbd_*` в URL (родитель). */
	jtbdOpsUrlEpoch: number;
	onJtbdOpsUrlChange?: () => void;
}

export function JtbdSection(props: JtbdSectionProps) {
	const { t } = useTranslation('marketing');
	const {
		selectedProjectId,
		selectedCompanyId,
		jobStorySearch,
		setJobStorySearch,
		debouncedJobStorySearch,
		allJobStories,
		filteredJobStories,
		jobStoriesQuery,
		selectedJobStoryIds,
		setSelectedJobStoryIds,
		allowMarketingWrite,
		handleCopyAllJobs,
		handleExportJobs,
		handleCopySingleJob,
		setJtbdContextMenu,
		createJobStoryMutation,
		extractJobStoriesMutation,
		jobStoryForm,
		setJobStoryForm,
		jobStoryCategorySelectOptions,
		jobStoryPrioritySelectOptions,
		handleCreateJobStory,
		handleExtractJobStories,
		jobStoryExtractText,
		setJobStoryExtractText,
		jobStoryExtractCount,
		setJobStoryExtractCount,
		jobStoryExtractRunId,
		jobStoryExtractRunQuery,
		setEditingJobStory,
		setDeleteModal,
		jtbdOpsUrlEpoch,
		onJtbdOpsUrlChange,
	} = props;

	const jobStoriesDbTotal = jobStoriesQuery.data?.total ?? allJobStories.length;
	const jobStoriesFetchTruncated = jobStoriesDbTotal > allJobStories.length;

	const dashboardJtbdFilters = useMemo(() => {
		void jtbdOpsUrlEpoch;
		if (typeof window === 'undefined') {
			return { category: '', priority: '', validated: '' };
		}
		return parseMarketingCabinetOpsListFilters(window.location.search).jtbd;
	}, [jtbdOpsUrlEpoch]);

	const setJtbdUrlFilter = useCallback(
		(key: string, value: string) => {
			if (typeof window === 'undefined') return;
			const url = new URL(window.location.href);
			const v = value.trim();
			if (v) url.searchParams.set(key, v);
			else url.searchParams.delete(key);
			window.history.replaceState({}, '', url.toString());
			onJtbdOpsUrlChange?.();
		},
		[onJtbdOpsUrlChange]
	);

	const clearJtbdListFilters = useCallback(() => {
		setJobStorySearch('');
		if (typeof window === 'undefined') return;
		const url = new URL(window.location.href);
		url.searchParams.delete(MC_OPS_JTBD_CATEGORY);
		url.searchParams.delete(MC_OPS_JTBD_PRIORITY);
		url.searchParams.delete(MC_OPS_JTBD_VALIDATED);
		window.history.replaceState({}, '', url.toString());
		onJtbdOpsUrlChange?.();
	}, [onJtbdOpsUrlChange, setJobStorySearch]);

	const jtbdCategoryFilterOptions = useMemo(
		() => [
			{ value: '', label: t('overview.dashboard.listFilter.all') },
			...jobStoryCategorySelectOptions,
		],
		[jobStoryCategorySelectOptions, t]
	);
	const jtbdPriorityFilterOptions = useMemo(
		() => [
			{ value: '', label: t('overview.dashboard.listFilter.all') },
			...jobStoryPrioritySelectOptions,
		],
		[jobStoryPrioritySelectOptions, t]
	);
	const jtbdValidatedFilterOptions = useMemo(
		() => [
			{ value: '', label: t('overview.dashboard.listFilter.all') },
			{
				value: 'true',
				label: t('overview.dashboard.listFilter.jtbdValidatedYes'),
			},
			{
				value: 'false',
				label: t('overview.dashboard.listFilter.jtbdValidatedNo'),
			},
		],
		[t]
	);

	if (!selectedProjectId) {
		return (
			<EmptyProjectState
				title={t('cabinetPage.jtbd.emptyTitle')}
				description={t('cabinetPage.jtbd.emptyDescription')}
			/>
		);
	}

	return (
		<div className="grid gap-6 xl:grid-cols-[1.15fr_0.95fr] xl:gap-6">
			<SectionPanel
				title={t('cabinetPage.jtbd.listTitle')}
				description={t('cabinetPage.jtbd.listDescription')}
				helpBlockId="jtbd.list"
				actions={
					<div className="flex items-center gap-2">
						<DesktopAppInput
							placeholder={t('cabinetPage.jtbd.searchPlaceholder')}
							value={jobStorySearch}
							onChange={(e) => setJobStorySearch(e.target.value)}
							className="w-64"
							aria-label={t('cabinetPage.jtbd.searchAria')}
						/>
						{jobStorySearch.trim() ? (
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => setJobStorySearch('')}
								aria-label={t('evidenceView.clearSearchAria')}
							>
								<PaintBrushIcon
									className="h-3.5 w-3.5"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							</DesktopAppButton>
						) : null}
						{allJobStories.length > 0 ? (
							<>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="sm"
									onClick={handleCopyAllJobs}
									aria-label={t('cabinetPage.jtbd.copyAllAria')}
								>
									<ClipboardDocumentIcon
										className="h-4 w-4"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
									{t('evidenceView.copyButton')}
								</DesktopAppButton>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="sm"
									onClick={handleExportJobs}
									aria-label={t('cabinetPage.jtbd.exportCsvAria')}
								>
									<ArrowDownTrayIcon
										className="h-4 w-4"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
									{t('evidenceView.csvButton')}
								</DesktopAppButton>
							</>
						) : null}
						{allowMarketingWrite ? (
							<>
								<MarketingSectionGenerateAiButton
									projectId={selectedProjectId}
									companyId={selectedCompanyId}
									targetSection="jtbd"
									allowMarketingWrite={allowMarketingWrite}
									invalidateQueryKeys={[
										marketingCabinetProjectSectionInvalidationQueryKey(
											'jtbd',
											selectedProjectId
										),
										marketingCabinetProjectDashboardInvalidationQueryKey(
											selectedProjectId
										),
									]}
								/>
								<DocumentAutofillAction
									projectId={selectedProjectId}
									companyId={selectedCompanyId}
									targetSection="jtbd"
									targetLabel={t('cabinetPage.jtbd.docAutofillLabel')}
									invalidateQueryKeys={[
										marketingCabinetProjectSectionInvalidationQueryKey(
											'jtbd',
											selectedProjectId
										),
										marketingCabinetProjectDashboardInvalidationQueryKey(
											selectedProjectId
										),
									]}
								/>
							</>
						) : null}
					</div>
				}
			>
				{jobStoriesQuery.isLoading ? (
					<LoadingGrid />
				) : jobStoriesQuery.isError ? (
					<DesktopAppErrorState
						message={extractApiErrorMessage(
							jobStoriesQuery.error,
							t('cabinetPage.jtbd.loadError')
						)}
						onAction={() => void jobStoriesQuery.refetch()}
					/>
				) : (
					<>
						{allJobStories.length > 0 ? (
							<div className="mb-3 flex flex-wrap gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle)/80 bg-(--desktop-surface-soft)/40 p-2">
								<div className="min-w-36 flex-1">
									<MarketingCabinetSelect
										size="compact"
										value={dashboardJtbdFilters.category}
										aria-label={t(
											'overview.dashboard.listFilter.jtbdCategoryAria'
										)}
										options={jtbdCategoryFilterOptions}
										onChange={(v) => setJtbdUrlFilter(MC_OPS_JTBD_CATEGORY, v)}
									/>
								</div>
								<div className="min-w-36 flex-1">
									<MarketingCabinetSelect
										size="compact"
										value={dashboardJtbdFilters.priority}
										aria-label={t(
											'overview.dashboard.listFilter.jtbdPriorityAria'
										)}
										options={jtbdPriorityFilterOptions}
										onChange={(v) => setJtbdUrlFilter(MC_OPS_JTBD_PRIORITY, v)}
									/>
								</div>
								<div className="min-w-36 flex-1">
									<MarketingCabinetSelect
										size="compact"
										value={dashboardJtbdFilters.validated}
										aria-label={t(
											'overview.dashboard.listFilter.jtbdValidatedAria'
										)}
										options={jtbdValidatedFilterOptions}
										onChange={(v) => setJtbdUrlFilter(MC_OPS_JTBD_VALIDATED, v)}
									/>
								</div>
							</div>
						) : null}
						{allJobStories.length === 0 ? (
							<DesktopAppEmptyState
								title={t('cabinetPage.jtbd.emptyListTitle')}
								description={t('cabinetPage.jtbd.emptyListDescription')}
							/>
						) : filteredJobStories.length === 0 ? (
							<div className="space-y-3 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-6 text-center shadow-(--desktop-shadow-soft)">
								<p className="text-sm text-(--desktop-text-secondary)">
									{t('cabinetPage.jtbd.filterEmptyLine')}
								</p>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="sm"
									onClick={clearJtbdListFilters}
								>
									{t('cabinetPage.jtbd.resetSearch')}
								</DesktopAppButton>
							</div>
						) : filteredJobStories.length >
							MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD ? (
							<div className="space-y-2">
								<p className={cn('mc-meta-caption', DESKTOP_TYPOGRAPHY.meta)}>
									{debouncedJobStorySearch.trim() ||
									allJobStories.length > filteredJobStories.length
										? t('cabinetPage.jtbd.listSummaryPartial', {
												shown: filteredJobStories.length,
												total: allJobStories.length,
											})
										: jobStoriesFetchTruncated
											? t('cabinetPage.listFetchSummaryTruncated', {
													shown: allJobStories.length,
													total: jobStoriesDbTotal,
												})
											: t('cabinetPage.jtbd.listSummaryAll', {
													count: filteredJobStories.length,
												})}
								</p>
								<VirtualVariableList
									items={filteredJobStories}
									estimateSize={() => 140}
									getItemKey={(index) =>
										filteredJobStories[index]?.id ?? `jtbd-${index}`
									}
									height={420}
									overscanCount={5}
									className="rounded-(--desktop-radius)"
									renderItem={(job) => {
										const isSelected = selectedJobStoryIds.includes(job.id);
										return (
											<div className="pb-3">
												<MarketingEntityCard
													helpBlockId="jtbd.list"
													className="space-y-3 rounded-(--desktop-radius) p-4 outline-none ring-1 ring-transparent transition-[box-shadow,ring-color] focus-within:ring-(--mc-accent-30) hover:ring-(--desktop-border-subtle)"
													onContextMenu={(e) => {
														e.preventDefault();
														setJtbdContextMenu({
															x: e.clientX,
															y: e.clientY,
															job,
														});
													}}
												>
													<div className="flex flex-wrap items-start justify-between gap-3">
														<div className="space-y-1">
															<div className="text-sm font-medium text-(--desktop-text-primary)">
																{job.title}
															</div>
															<div className={cn(DESKTOP_TYPOGRAPHY.meta)}>
																{localizeJobCategory(job.category)} ·{' '}
																{localizePriority(job.priority)} ·{' '}
																{t('cabinetPage.jtbd.sourcePrefix')}{' '}
																{localizeSource(job.source)}
															</div>
														</div>
														<div className="flex items-center gap-1">
															{allowMarketingWrite ? (
																<DesktopAppButton
																	type="button"
																	variant="ghost"
																	size="sm"
																	active={isSelected}
																	aria-pressed={isSelected}
																	aria-label={
																		isSelected
																			? t('cabinetPage.jtbd.vpToggleRemoveAria')
																			: t('cabinetPage.jtbd.vpToggleAddAria')
																	}
																	onClick={() =>
																		setSelectedJobStoryIds((prev) =>
																			prev.includes(job.id)
																				? prev.filter((item) => item !== job.id)
																				: [...prev, job.id]
																		)
																	}
																>
																	{isSelected
																		? t('cabinetPage.jtbd.selectedForVp')
																		: t('cabinetPage.jtbd.useInVp')}
																</DesktopAppButton>
															) : null}
															<DesktopAppButton
																type="button"
																variant="ghost"
																size="icon"
																onClick={() => void handleCopySingleJob(job)}
																aria-label={t(
																	'cabinetPage.copy.copyJtbdCardAria'
																)}
															>
																<ClipboardDocumentIcon
																	className="h-4 w-4"
																	strokeWidth={DESKTOP_LUCIDE.stroke}
																/>
															</DesktopAppButton>
															{allowMarketingWrite ? (
																<>
																	<DesktopAppButton
																		type="button"
																		variant="ghost"
																		size="icon"
																		onClick={() => setEditingJobStory(job)}
																		aria-label={t(
																			'cabinetPage.jtbd.editJobAria',
																			{
																				title: job.title,
																			}
																		)}
																	>
																		<PencilSquareIcon
																			className="h-4 w-4"
																			strokeWidth={DESKTOP_LUCIDE.stroke}
																		/>
																	</DesktopAppButton>
																	<DesktopAppButton
																		type="button"
																		variant="ghost"
																		size="icon"
																		onClick={() =>
																			setDeleteModal({
																				type: 'job',
																				id: job.id,
																				name: job.title,
																			})
																		}
																		aria-label={t(
																			'cabinetPage.jtbd.deleteJobAria',
																			{
																				title: job.title,
																			}
																		)}
																	>
																		<TrashIcon
																			className="h-4 w-4"
																			strokeWidth={DESKTOP_LUCIDE.stroke}
																		/>
																	</DesktopAppButton>
																</>
															) : null}
														</div>
													</div>
													<p className="text-sm leading-6 text-(--desktop-text-secondary)">
														{job.statement}
													</p>
													<TokenList
														items={job.tags ?? []}
														emptyText={t('cabinetPage.jtbd.tagsEmpty')}
													/>
												</MarketingEntityCard>
											</div>
										);
									}}
								/>
							</div>
						) : (
							<div className="space-y-3">
								{debouncedJobStorySearch.trim() ||
								allJobStories.length > filteredJobStories.length ||
								jobStoriesFetchTruncated ? (
									<p className={cn('mc-meta-caption', DESKTOP_TYPOGRAPHY.meta)}>
										{debouncedJobStorySearch.trim() ||
										allJobStories.length > filteredJobStories.length
											? t('cabinetPage.jtbd.listSummaryPartial', {
													shown: filteredJobStories.length,
													total: allJobStories.length,
												})
											: t('cabinetPage.listFetchSummaryTruncated', {
													shown: allJobStories.length,
													total: jobStoriesDbTotal,
												})}
									</p>
								) : null}
								{filteredJobStories.map((job) => {
									const isSelected = selectedJobStoryIds.includes(job.id);
									return (
										<MarketingEntityCard
											key={job.id}
											helpBlockId="jtbd.list"
											className="space-y-3 rounded-(--desktop-radius) p-4 outline-none ring-1 ring-transparent transition-[box-shadow,ring-color] focus-within:ring-(--mc-accent-30) hover:ring-(--desktop-border-subtle)"
											onContextMenu={(e) => {
												e.preventDefault();
												setJtbdContextMenu({ x: e.clientX, y: e.clientY, job });
											}}
										>
											<div className="flex flex-wrap items-start justify-between gap-3">
												<div className="space-y-1">
													<div className="text-sm font-medium text-(--desktop-text-primary)">
														{job.title}
													</div>
													<div className={cn(DESKTOP_TYPOGRAPHY.meta)}>
														{localizeJobCategory(job.category)} ·{' '}
														{localizePriority(job.priority)} ·{' '}
														{t('cabinetPage.jtbd.sourcePrefix')}{' '}
														{localizeSource(job.source)}
													</div>
												</div>
												<div className="flex items-center gap-1">
													{allowMarketingWrite ? (
														<DesktopAppButton
															type="button"
															variant="ghost"
															size="sm"
															active={isSelected}
															aria-pressed={isSelected}
															aria-label={
																isSelected
																	? t('cabinetPage.jtbd.vpToggleRemoveAria')
																	: t('cabinetPage.jtbd.vpToggleAddAria')
															}
															onClick={() =>
																setSelectedJobStoryIds((prev) =>
																	prev.includes(job.id)
																		? prev.filter((item) => item !== job.id)
																		: [...prev, job.id]
																)
															}
														>
															{isSelected
																? t('cabinetPage.jtbd.selectedForVp')
																: t('cabinetPage.jtbd.useInVp')}
														</DesktopAppButton>
													) : null}
													<DesktopAppButton
														type="button"
														variant="ghost"
														size="icon"
														onClick={() => void handleCopySingleJob(job)}
														aria-label={t('cabinetPage.copy.copyJtbdCardAria')}
													>
														<ClipboardDocumentIcon
															className="h-4 w-4"
															strokeWidth={DESKTOP_LUCIDE.stroke}
														/>
													</DesktopAppButton>
													{allowMarketingWrite ? (
														<>
															<DesktopAppButton
																type="button"
																variant="ghost"
																size="icon"
																onClick={() => setEditingJobStory(job)}
																aria-label={t('cabinetPage.jtbd.editJobAria', {
																	title: job.title,
																})}
															>
																<PencilSquareIcon
																	className="h-4 w-4"
																	strokeWidth={DESKTOP_LUCIDE.stroke}
																/>
															</DesktopAppButton>
															<DesktopAppButton
																type="button"
																variant="ghost"
																size="icon"
																onClick={() =>
																	setDeleteModal({
																		type: 'job',
																		id: job.id,
																		name: job.title,
																	})
																}
																aria-label={t(
																	'cabinetPage.jtbd.deleteJobAria',
																	{
																		title: job.title,
																	}
																)}
															>
																<TrashIcon
																	className="h-4 w-4"
																	strokeWidth={DESKTOP_LUCIDE.stroke}
																/>
															</DesktopAppButton>
														</>
													) : null}
												</div>
											</div>
											<p className="text-sm leading-6 text-(--desktop-text-secondary)">
												{job.statement}
											</p>
											<TokenList
												items={job.tags ?? []}
												emptyText={t('cabinetPage.jtbd.tagsEmpty')}
											/>
										</MarketingEntityCard>
									);
								})}
							</div>
						)}
					</>
				)}
			</SectionPanel>

			{allowMarketingWrite ? (
				<div className="grid gap-6 xl:gap-6">
					<SectionPanel
						title={t('cabinetPage.jtbd.manualCreateTitle')}
						description={t('cabinetPage.jtbd.manualCreateDescription')}
						helpBlockId="jtbd.manual_create"
					>
						<form className="space-y-3" onSubmit={handleCreateJobStory}>
							<FieldLabel label={t('cabinetPage.jtbd.fieldTitle')}>
								<DesktopAppInput
									value={jobStoryForm.title}
									onChange={(event) =>
										setJobStoryForm((prev) => ({
											...prev,
											title: event.target.value,
										}))
									}
									placeholder={t('cabinetPage.jtbd.phJobTitle')}
								/>
							</FieldLabel>
							<FieldLabel label={t('cabinetPage.jtbd.fieldSituation')} required>
								<textarea
									className={TEXTAREA_CLASS}
									value={jobStoryForm.situation}
									onChange={(event) =>
										setJobStoryForm((prev) => ({
											...prev,
											situation: event.target.value,
										}))
									}
									placeholder={t('cabinetPage.jtbd.phSituation')}
								/>
							</FieldLabel>
							<FieldLabel
								label={t('cabinetPage.jtbd.fieldMotivation')}
								required
							>
								<textarea
									className={TEXTAREA_CLASS}
									value={jobStoryForm.motivation}
									onChange={(event) =>
										setJobStoryForm((prev) => ({
											...prev,
											motivation: event.target.value,
										}))
									}
									placeholder={t('cabinetPage.jtbd.phMotivation')}
								/>
							</FieldLabel>
							<FieldLabel label={t('cabinetPage.jtbd.fieldOutcome')} required>
								<textarea
									className={TEXTAREA_CLASS}
									value={jobStoryForm.outcome}
									onChange={(event) =>
										setJobStoryForm((prev) => ({
											...prev,
											outcome: event.target.value,
										}))
									}
									placeholder={t('cabinetPage.jtbd.phOutcome')}
								/>
							</FieldLabel>
							<div className={INPUT_STACK_CLASS}>
								<FieldLabel label={t('cabinetPage.jtbd.fieldCategory')}>
									<MarketingCabinetSelect
										value={jobStoryForm.category}
										onChange={(v) =>
											setJobStoryForm((prev) => ({ ...prev, category: v }))
										}
										options={jobStoryCategorySelectOptions}
									/>
								</FieldLabel>
								<FieldLabel label={t('cabinetPage.jtbd.fieldPriority')}>
									<MarketingCabinetSelect
										value={jobStoryForm.priority}
										onChange={(v) =>
											setJobStoryForm((prev) => ({ ...prev, priority: v }))
										}
										options={jobStoryPrioritySelectOptions}
									/>
								</FieldLabel>
							</div>
							<div className={INPUT_STACK_CLASS}>
								<FieldLabel
									label={t('cabinetPage.jtbd.fieldImportance')}
									hint={t('cabinetPage.jtbd.hintScore')}
								>
									<MarketingCabinetSelect
										value={jobStoryForm.importance_score}
										onChange={(v) =>
											setJobStoryForm((prev) => ({
												...prev,
												importance_score: v,
											}))
										}
										options={getJtbdScoreSelectOptions()}
									/>
								</FieldLabel>
								<FieldLabel
									label={t('cabinetPage.jtbd.fieldSatisfaction')}
									hint={t('cabinetPage.jtbd.hintScore')}
								>
									<MarketingCabinetSelect
										value={jobStoryForm.satisfaction_score}
										onChange={(v) =>
											setJobStoryForm((prev) => ({
												...prev,
												satisfaction_score: v,
											}))
										}
										options={getJtbdScoreSelectOptions()}
									/>
								</FieldLabel>
							</div>
							<FieldLabel
								label={t('cabinetPage.jtbd.fieldTags')}
								hint={t('cabinetPage.jtbd.tagsHint')}
							>
								<textarea
									className={TEXTAREA_CLASS}
									value={jobStoryForm.tags}
									onChange={(event) =>
										setJobStoryForm((prev) => ({
											...prev,
											tags: event.target.value,
										}))
									}
									placeholder={t('cabinetPage.jtbd.phTags')}
								/>
							</FieldLabel>
							<DesktopAppButton
								type="submit"
								variant="accent"
								disabled={
									createJobStoryMutation.isPending ||
									!jobStoryForm.situation.trim() ||
									!jobStoryForm.motivation.trim() ||
									!jobStoryForm.outcome.trim()
								}
							>
								{createJobStoryMutation.isPending ? (
									<ArrowPathIcon
										className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								) : (
									<PlusIcon
										className="h-4 w-4"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								)}
								{t('cabinetPage.jtbd.submitJob')}
							</DesktopAppButton>
						</form>
					</SectionPanel>

					<SectionPanel
						title={t('cabinetPage.jtbd.aiExtractTitle')}
						description={t('cabinetPage.jtbd.aiExtractDescription')}
						helpBlockId="jtbd.ai_extract"
					>
						<form className="space-y-3" onSubmit={handleExtractJobStories}>
							<FieldLabel
								label={t('cabinetPage.jtbd.interviewLabel')}
								hint={
									jobStoryExtractText.length > 0
										? jobStoryExtractText.length >= 100
											? t('cabinetPage.jtbd.charsCount', {
													count: jobStoryExtractText.length,
												})
											: t('cabinetPage.jtbd.charsProgress', {
													count: jobStoryExtractText.length,
												})
										: undefined
								}
							>
								<textarea
									className="min-h-[240px] w-full rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2.5 text-sm text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim) outline-none transition-colors focus:border-(--desktop-border-strong) focus:ring-1 focus:ring-(--mc-accent-30)"
									value={jobStoryExtractText}
									onChange={(event) =>
										setJobStoryExtractText(event.target.value)
									}
									placeholder={t('cabinetPage.jtbd.interviewPlaceholder')}
								/>
							</FieldLabel>
							<FieldLabel label={t('cabinetPage.jtbd.maxStoriesLabel')}>
								<DesktopAppInput
									value={jobStoryExtractCount}
									onChange={(event) =>
										setJobStoryExtractCount(event.target.value)
									}
									placeholder="6"
								/>
							</FieldLabel>
							<div className="flex flex-wrap items-center gap-2">
								<DesktopAppButton
									type="submit"
									variant="accent"
									disabled={
										!selectedProjectId ||
										jobStoryExtractText.trim().length < 100 ||
										extractJobStoriesMutation.isPending ||
										Boolean(jobStoryExtractRunId)
									}
									aria-label={t('cabinetPage.jtbd.extractAria')}
								>
									{extractJobStoriesMutation.isPending ||
									jobStoryExtractRunId ? (
										<ArrowPathIcon
											className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
									) : (
										<SparklesIcon
											className="h-4 w-4"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
									)}
									{jobStoryExtractRunId
										? t('cabinetPage.jtbd.extracting')
										: t('cabinetPage.jtbd.extractCta')}
								</DesktopAppButton>
								{jobStoryExtractText.length > 0 ? (
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setJobStoryExtractText('')}
										aria-label={t('cabinetPage.jtbd.clearInterviewAria')}
									>
										<PaintBrushIcon
											className="h-3.5 w-3.5"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
										{t('cabinetPage.jtbd.clearInterview')}
									</DesktopAppButton>
								) : null}
							</div>
							{jobStoryExtractRunId ? (
								<DesktopAppSurface variant="soft" className="space-y-1 p-3">
									<div className="text-sm text-(--desktop-text-secondary)">
										{t('cabinetPage.jtbd.aiRunStatusPrefix')}{' '}
										{localizeStatus(
											jobStoryExtractRunQuery.data?.queue?.status ||
												jobStoryExtractRunQuery.data?.run.status ||
												'processing'
										)}
									</div>
									<div className={cn(DESKTOP_TYPOGRAPHY.meta)}>
										{t('cabinetPage.jtbd.aiRunQueueLine', {
											waiting:
												jobStoryExtractRunQuery.data?.queue?.waiting_count ??
												'...',
											processing:
												jobStoryExtractRunQuery.data?.queue?.processing_count ??
												'...',
										})}
									</div>
								</DesktopAppSurface>
							) : null}
						</form>
					</SectionPanel>
				</div>
			) : null}
		</div>
	);
}
