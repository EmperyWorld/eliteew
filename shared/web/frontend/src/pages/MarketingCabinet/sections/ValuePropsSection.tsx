import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	ClipboardDocumentIcon,
	MegaphoneIcon,
	PaintBrushIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import { lazy, Suspense, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { VirtualVariableList } from '@/components/shared/VirtualList';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppErrorState,
	DesktopAppInput,
	DesktopAppSectionLabel,
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
	MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD,
	TEXTAREA_CLASS,
} from '../constants';
import { useMarketingShellClasses } from '../hooks/useMarketingShellClasses';
import { localizeStatus } from '../locales';
import type {
	MutationLike,
	QueryLike,
} from '../marketingCabinetPage/marketingCabinetComposeHosts';
import type { ValuePropFormState } from '../marketingCabinetPageTypes';
import type {
	MarketingJobStory,
	MarketingListResponse,
	MarketingValueProposition,
} from '../marketingCabinetApi';
import { extractApiErrorMessage } from '../utils';
import type { MarketingDeleteModalSetter } from './CompaniesSection';
import {
	marketingCabinetProjectDashboardInvalidationQueryKey,
	marketingCabinetProjectSectionInvalidationQueryKey,
} from '../marketingCabinetQueryOptions';

import {
	MC_OPS_VALUE_PROP_STATUS,
	parseMarketingCabinetOpsListFilters,
} from '../operationsDeepLink';

const SortableProofPointsField = lazy(() =>
	import('../components/SortableProofPointsField').then((m) => ({
		default: m.SortableProofPointsField,
	}))
);

export interface ValuePropsSectionProps {
	selectedProjectId: string | null;
	selectedCompanyId: string | null;
	valuePropSearch: string;
	setValuePropSearch: React.Dispatch<React.SetStateAction<string>>;
	debouncedValuePropSearch: string;
	filteredValuePropositions: MarketingValueProposition[];
	valuePropositions: MarketingValueProposition[];
	valuePropsQuery: QueryLike<MarketingListResponse<MarketingValueProposition>>;
	allowMarketingWrite: boolean;
	handleCopyAllValueProps: () => void | Promise<void>;
	handleExportValueProps: () => void | Promise<void>;
	handleCopySingleValueProp: (
		vp: MarketingValueProposition
	) => void | Promise<void>;
	setDeleteModal: MarketingDeleteModalSetter;
	valuePropForm: ValuePropFormState;
	setValuePropForm: React.Dispatch<React.SetStateAction<ValuePropFormState>>;
	valuePropInlineStatusOptions: Array<{ value: string; label: string }>;
	handleCreateValueProp: (event: React.FormEvent) => void;
	createValuePropMutation: MutationLike;
	updateValuePropMutation: MutationLike;
	allJobStories: MarketingJobStory[];
	selectedJobStoryIds: string[];
	setSelectedJobStoryIds: React.Dispatch<React.SetStateAction<string[]>>;
	valuePropOpsUrlEpoch: number;
	onValuePropOpsUrlChange?: () => void;
}

export function ValuePropsSection(props: ValuePropsSectionProps) {
	const { t } = useTranslation('marketing');
	const { toolbarInset, checkboxControl } = useMarketingShellClasses();
	const {
		selectedProjectId,
		selectedCompanyId,
		valuePropSearch,
		setValuePropSearch,
		debouncedValuePropSearch,
		filteredValuePropositions,
		valuePropositions,
		valuePropsQuery,
		allowMarketingWrite,
		handleCopyAllValueProps,
		handleExportValueProps,
		handleCopySingleValueProp,
		setDeleteModal,
		valuePropForm,
		setValuePropForm,
		valuePropInlineStatusOptions,
		handleCreateValueProp,
		createValuePropMutation,
		updateValuePropMutation,
		allJobStories,
		selectedJobStoryIds,
		setSelectedJobStoryIds,
		valuePropOpsUrlEpoch,
		onValuePropOpsUrlChange,
	} = props;

	const valuePropsDbTotal =
		valuePropsQuery.data?.total ?? valuePropositions.length;
	const valuePropsFetchTruncated = valuePropsDbTotal > valuePropositions.length;

	const dashboardValuePropFilters = useMemo(() => {
		void valuePropOpsUrlEpoch;
		if (typeof window === 'undefined') {
			return { status: '' };
		}
		return parseMarketingCabinetOpsListFilters(window.location.search)
			.valueProp;
	}, [valuePropOpsUrlEpoch]);

	const setValuePropUrlFilter = useCallback(
		(key: string, value: string) => {
			if (typeof window === 'undefined') return;
			const url = new URL(window.location.href);
			const v = value.trim();
			if (v) url.searchParams.set(key, v);
			else url.searchParams.delete(key);
			window.history.replaceState({}, '', url.toString());
			onValuePropOpsUrlChange?.();
		},
		[onValuePropOpsUrlChange]
	);

	const clearValuePropListFilters = useCallback(() => {
		setValuePropSearch('');
		if (typeof window === 'undefined') return;
		const url = new URL(window.location.href);
		url.searchParams.delete(MC_OPS_VALUE_PROP_STATUS);
		window.history.replaceState({}, '', url.toString());
		onValuePropOpsUrlChange?.();
	}, [onValuePropOpsUrlChange, setValuePropSearch]);

	const valuePropStatusFilterOptions = useMemo(
		() => [
			{ value: '', label: t('overview.dashboard.listFilter.all') },
			...valuePropInlineStatusOptions,
		],
		[valuePropInlineStatusOptions, t]
	);

	const renderJtbdPickLabel = (job: MarketingJobStory) => {
		const checked = selectedJobStoryIds.includes(job.id);
		return (
			<label
				className={cn(
					'flex cursor-pointer items-start gap-3 rounded-(--desktop-radius) px-3 py-2.5 transition-colors',
					checked
						? 'border border-(--mc-accent-40) bg-(--desktop-surface-accent)'
						: toolbarInset
				)}
			>
				<input
					type="checkbox"
					className={checkboxControl}
					checked={checked}
					onChange={() =>
						setSelectedJobStoryIds((prev) =>
							prev.includes(job.id)
								? prev.filter((item) => item !== job.id)
								: [...prev, job.id]
						)
					}
				/>
				<span className="flex-1">
					<span className="block text-sm font-medium text-(--desktop-text-primary)">
						{job.title}
					</span>
					<span className={cn(DESKTOP_TYPOGRAPHY.meta, 'mt-1 block leading-5')}>
						{job.statement}
					</span>
				</span>
			</label>
		);
	};

	if (!selectedProjectId) {
		return (
			<EmptyProjectState
				title={t('cabinetPage.valueProp.emptyTitle')}
				description={t('cabinetPage.valueProp.emptyDescription')}
			/>
		);
	}

	return (
		<div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:gap-6">
			<SectionPanel
				title={t('cabinetPage.valueProp.listTitle')}
				description={t('cabinetPage.valueProp.listDescription')}
				helpBlockId="value.list"
				actions={
					<div className="flex items-center gap-2">
						<DesktopAppInput
							placeholder={t('cabinetPage.valueProp.searchPlaceholder')}
							value={valuePropSearch}
							onChange={(e) => setValuePropSearch(e.target.value)}
							aria-label={t('cabinetPage.valueProp.searchAria')}
							className="w-56"
						/>
						{valuePropSearch.trim() ? (
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => setValuePropSearch('')}
								aria-label={t('evidenceView.clearSearchAria')}
							>
								<PaintBrushIcon
									className="h-3.5 w-3.5"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							</DesktopAppButton>
						) : null}
						{filteredValuePropositions.length > 0 ? (
							<>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="sm"
									onClick={handleCopyAllValueProps}
									aria-label={t('cabinetPage.valueProp.copyAllAria')}
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
									onClick={handleExportValueProps}
									aria-label={t('cabinetPage.valueProp.exportCsvAria')}
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
									targetSection="value_propositions"
									allowMarketingWrite={allowMarketingWrite}
									invalidateQueryKeys={[
										marketingCabinetProjectSectionInvalidationQueryKey(
											'value-propositions',
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
									targetSection="value_propositions"
									targetLabel={t('cabinetPage.valueProp.docAutofillLabel')}
									invalidateQueryKeys={[
										marketingCabinetProjectSectionInvalidationQueryKey(
											'value-propositions',
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
				{valuePropsQuery.isLoading ? (
					<LoadingGrid />
				) : valuePropsQuery.isError ? (
					<DesktopAppErrorState
						message={extractApiErrorMessage(
							valuePropsQuery.error,
							t('cabinetPage.valueProp.loadError')
						)}
						onAction={() => void valuePropsQuery.refetch()}
					/>
				) : (
					<>
						{valuePropositions.length > 0 ? (
							<div className="mb-3 flex flex-wrap gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle)/80 bg-(--desktop-surface-soft)/40 p-2">
								<div className="min-w-36 flex-1">
									<MarketingCabinetSelect
										size="compact"
										value={dashboardValuePropFilters.status}
										aria-label={t(
											'overview.dashboard.listFilter.valuePropStatusAria'
										)}
										options={valuePropStatusFilterOptions}
										onChange={(v) =>
											setValuePropUrlFilter(MC_OPS_VALUE_PROP_STATUS, v)
										}
									/>
								</div>
							</div>
						) : null}
						{filteredValuePropositions.length > 0 ? (
							filteredValuePropositions.length >
							MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD ? (
								<div className="space-y-2">
									<p className={cn('mc-meta-caption', DESKTOP_TYPOGRAPHY.meta)}>
										{valuePropositions.length > filteredValuePropositions.length
											? t('cabinetPage.valueProp.listSummaryPartial', {
													shown: filteredValuePropositions.length,
													total: valuePropositions.length,
												})
											: valuePropsFetchTruncated
												? t('cabinetPage.listFetchSummaryTruncated', {
														shown: valuePropositions.length,
														total: valuePropsDbTotal,
													})
												: t('cabinetPage.valueProp.listSummaryAll', {
														count: filteredValuePropositions.length,
													})}
									</p>
									<VirtualVariableList
										items={filteredValuePropositions}
										estimateSize={() => 180}
										getItemKey={(index) =>
											filteredValuePropositions[index]?.id ?? `vp-${index}`
										}
										height={420}
										overscanCount={5}
										className="rounded-(--desktop-radius)"
										renderItem={(valueProp) => (
											<div className="pb-3">
												<MarketingEntityCard
													helpBlockId="value.list"
													className="space-y-3 p-4"
												>
													<div className="flex flex-wrap items-center justify-between gap-3">
														<div className="min-w-0 flex-1 space-y-1">
															<div className="text-sm font-medium text-(--desktop-text-primary)">
																{valueProp.headline ||
																	t('cabinetPage.valueProp.noHeadline')}
															</div>
															<div className={cn(DESKTOP_TYPOGRAPHY.meta)}>
																{valueProp.subheadline ||
																	t('cabinetPage.valueProp.noSubheadline')}{' '}
																· {localizeStatus(valueProp.status)}
															</div>
														</div>
														<div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
															{updateValuePropMutation.isPending &&
															updateValuePropMutation.variables?.valuePropId ===
																valueProp.id ? (
																<ArrowPathIcon
																	className="h-3.5 w-3.5 shrink-0 motion-safe:animate-spin motion-reduce:animate-none text-(--desktop-text-muted)"
																	strokeWidth={DESKTOP_LUCIDE.stroke}
																/>
															) : null}
															<DesktopAppButton
																type="button"
																variant="ghost"
																size="icon"
																onClick={() =>
																	void handleCopySingleValueProp(valueProp)
																}
																aria-label={t(
																	'cabinetPage.copy.copyValuePropCardAria'
																)}
															>
																<ClipboardDocumentIcon
																	className="h-4 w-4"
																	strokeWidth={DESKTOP_LUCIDE.stroke}
																/>
															</DesktopAppButton>
															<MarketingCabinetSelect
																size="compact"
																className="min-w-[min(100%,11rem)] w-[min(100%,11rem)] shrink-0"
																value={valueProp.status || 'draft'}
																onChange={(v) =>
																	updateValuePropMutation.mutate({
																		valuePropId: valueProp.id,
																		payload: { status: v },
																	})
																}
																disabled={
																	updateValuePropMutation.isPending &&
																	updateValuePropMutation.variables
																		?.valuePropId === valueProp.id
																}
																aria-label={t(
																	'cabinetPage.valueProp.statusSelectAria',
																	{
																		name:
																			valueProp.headline ||
																			valueProp.subheadline ||
																			t(
																				'cabinetPage.valueProp.statusSelectFallback'
																			),
																	}
																)}
																options={valuePropInlineStatusOptions}
															/>
															<DesktopAppButton
																type="button"
																variant="ghost"
																size="icon"
																onClick={() =>
																	setDeleteModal({
																		type: 'valueProp',
																		id: valueProp.id,
																		name:
																			valueProp.headline ||
																			valueProp.subheadline ||
																			t('cabinetPage.valueProp.defaultVpName'),
																	})
																}
																aria-label={t(
																	'cabinetPage.valueProp.deleteVpAria',
																	{
																		name:
																			valueProp.headline ||
																			valueProp.subheadline ||
																			t('cabinetPage.valueProp.untitledVp'),
																	}
																)}
															>
																<TrashIcon
																	className="h-4 w-4"
																	strokeWidth={DESKTOP_LUCIDE.stroke}
																/>
															</DesktopAppButton>
														</div>
													</div>
													<p className="text-sm leading-6 text-(--desktop-text-secondary)">
														{valueProp.value_statement ||
															t('cabinetPage.valueProp.statementEmpty')}
													</p>
													<TokenList
														items={(valueProp.proof_points ?? []).filter(
															(point): point is string =>
																typeof point === 'string'
														)}
														emptyText={t('cabinetPage.valueProp.proofEmpty')}
													/>
													{valueProp.addressed_jobs &&
													valueProp.addressed_jobs.length > 0 ? (
														<div className="space-y-2">
															<DesktopAppSectionLabel>
																{t('cabinetPage.valueProp.addressedJobsLabel')}
															</DesktopAppSectionLabel>
															<div className="space-y-2">
																{valueProp.addressed_jobs.map((job, idx) => {
																	const row =
																		typeof job === 'object' && job
																			? (job as {
																					id?: unknown;
																					title?: unknown;
																				})
																			: {};
																	return (
																		<div
																			key={String(row.id ?? idx)}
																			className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) px-3 py-2 text-xs text-(--desktop-text-secondary)"
																		>
																			{String(row.title ?? '')}
																		</div>
																	);
																})}
															</div>
														</div>
													) : null}
												</MarketingEntityCard>
											</div>
										)}
									/>
								</div>
							) : (
								<div className="space-y-3">
									{valuePropositions.length >
										filteredValuePropositions.length ||
									valuePropsFetchTruncated ? (
										<p
											className={cn('mc-meta-caption', DESKTOP_TYPOGRAPHY.meta)}
										>
											{valuePropositions.length >
											filteredValuePropositions.length
												? t('cabinetPage.valueProp.listSummaryPartial', {
														shown: filteredValuePropositions.length,
														total: valuePropositions.length,
													})
												: t('cabinetPage.listFetchSummaryTruncated', {
														shown: valuePropositions.length,
														total: valuePropsDbTotal,
													})}
										</p>
									) : null}
									{filteredValuePropositions.map((valueProp) => (
										<MarketingEntityCard
											key={valueProp.id}
											helpBlockId="value.list"
											className="space-y-3 p-4"
										>
											<div className="flex flex-wrap items-center justify-between gap-3">
												<div className="min-w-0 flex-1 space-y-1">
													<div className="text-sm font-medium text-(--desktop-text-primary)">
														{valueProp.headline ||
															t('cabinetPage.valueProp.noHeadline')}
													</div>
													<div className={cn(DESKTOP_TYPOGRAPHY.meta)}>
														{valueProp.subheadline ||
															t('cabinetPage.valueProp.noSubheadline')}{' '}
														· {localizeStatus(valueProp.status)}
													</div>
												</div>
												<div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
													{updateValuePropMutation.isPending &&
													updateValuePropMutation.variables?.valuePropId ===
														valueProp.id ? (
														<ArrowPathIcon
															className="h-3.5 w-3.5 shrink-0 motion-safe:animate-spin motion-reduce:animate-none text-(--desktop-text-muted)"
															strokeWidth={DESKTOP_LUCIDE.stroke}
														/>
													) : null}
													<DesktopAppButton
														type="button"
														variant="ghost"
														size="icon"
														onClick={() =>
															void handleCopySingleValueProp(valueProp)
														}
														aria-label={t(
															'cabinetPage.copy.copyValuePropCardAria'
														)}
													>
														<ClipboardDocumentIcon
															className="h-4 w-4"
															strokeWidth={DESKTOP_LUCIDE.stroke}
														/>
													</DesktopAppButton>
													<MarketingCabinetSelect
														size="compact"
														className="min-w-[min(100%,11rem)] w-[min(100%,11rem)] shrink-0"
														value={valueProp.status || 'draft'}
														onChange={(v) =>
															updateValuePropMutation.mutate({
																valuePropId: valueProp.id,
																payload: { status: v },
															})
														}
														disabled={
															updateValuePropMutation.isPending &&
															updateValuePropMutation.variables?.valuePropId ===
																valueProp.id
														}
														aria-label={t(
															'cabinetPage.valueProp.statusSelectAria',
															{
																name:
																	valueProp.headline ||
																	valueProp.subheadline ||
																	t(
																		'cabinetPage.valueProp.statusSelectFallback'
																	),
															}
														)}
														options={valuePropInlineStatusOptions}
													/>
													<DesktopAppButton
														type="button"
														variant="ghost"
														size="icon"
														onClick={() =>
															setDeleteModal({
																type: 'valueProp',
																id: valueProp.id,
																name:
																	valueProp.headline ||
																	valueProp.subheadline ||
																	t('cabinetPage.valueProp.defaultVpName'),
															})
														}
														aria-label={t(
															'cabinetPage.valueProp.deleteVpAria',
															{
																name:
																	valueProp.headline ||
																	valueProp.subheadline ||
																	t('cabinetPage.valueProp.untitledVp'),
															}
														)}
													>
														<TrashIcon
															className="h-4 w-4"
															strokeWidth={DESKTOP_LUCIDE.stroke}
														/>
													</DesktopAppButton>
												</div>
											</div>
											<p className="text-sm leading-6 text-(--desktop-text-secondary)">
												{valueProp.value_statement ||
													t('cabinetPage.valueProp.statementEmpty')}
											</p>
											<TokenList
												items={(valueProp.proof_points ?? []).filter(
													(point): point is string => typeof point === 'string'
												)}
												emptyText={t('cabinetPage.valueProp.proofEmpty')}
											/>
											{valueProp.addressed_jobs &&
											valueProp.addressed_jobs.length > 0 ? (
												<div className="space-y-2">
													<DesktopAppSectionLabel>
														{t('cabinetPage.valueProp.addressedJobsLabel')}
													</DesktopAppSectionLabel>
													<div className="space-y-2">
														{valueProp.addressed_jobs.map((job, idx) => {
															const row =
																typeof job === 'object' && job
																	? (job as {
																			id?: unknown;
																			title?: unknown;
																		})
																	: {};
															return (
																<div
																	key={String(row.id ?? idx)}
																	className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) px-3 py-2 text-xs text-(--desktop-text-secondary)"
																>
																	{String(row.title ?? '')}
																</div>
															);
														})}
													</div>
												</div>
											) : null}
										</MarketingEntityCard>
									))}
								</div>
							)
						) : valuePropositions.length > 0 ? (
							<div className="space-y-3 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-6 text-center shadow-(--desktop-shadow-soft)">
								<p className="text-sm text-(--desktop-text-secondary)">
									{debouncedValuePropSearch.trim()
										? t('cabinetPage.valueProp.searchEmptyDescription', {
												query: debouncedValuePropSearch,
											})
										: t('cabinetPage.valueProp.filterOpsEmptyDescription')}
								</p>
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="sm"
									onClick={clearValuePropListFilters}
								>
									{t('cabinetPage.jtbd.resetSearch')}
								</DesktopAppButton>
							</div>
						) : (
							<DesktopAppEmptyState
								title={t('cabinetPage.valueProp.listEmptyTitle')}
								description={t('cabinetPage.valueProp.listEmptyDescription')}
							/>
						)}
					</>
				)}
			</SectionPanel>

			<div className="grid gap-6 xl:gap-6">
				<SectionPanel
					title={t('cabinetPage.valueProp.createTitle')}
					description={t('cabinetPage.valueProp.createDescription')}
					helpBlockId="value.create"
				>
					<form className="space-y-3" onSubmit={handleCreateValueProp}>
						<FieldLabel label={t('cabinetPage.valueProp.fieldHeadline')}>
							<DesktopAppInput
								value={valuePropForm.headline}
								onChange={(event) =>
									setValuePropForm((prev) => ({
										...prev,
										headline: event.target.value,
									}))
								}
								placeholder={t('cabinetPage.valueProp.phHeadline')}
							/>
						</FieldLabel>
						<FieldLabel label={t('cabinetPage.valueProp.fieldSubheadline')}>
							<DesktopAppInput
								value={valuePropForm.subheadline}
								onChange={(event) =>
									setValuePropForm((prev) => ({
										...prev,
										subheadline: event.target.value,
									}))
								}
								placeholder={t('cabinetPage.valueProp.phSubheadline')}
							/>
						</FieldLabel>
						<FieldLabel label={t('cabinetPage.valueProp.fieldValueStatement')}>
							<textarea
								className={TEXTAREA_CLASS}
								value={valuePropForm.value_statement}
								onChange={(event) =>
									setValuePropForm((prev) => ({
										...prev,
										value_statement: event.target.value,
									}))
								}
								placeholder={t('cabinetPage.valueProp.phValueStatement')}
							/>
						</FieldLabel>
						<FieldLabel
							label={t('cabinetPage.valueProp.fieldProof')}
							hint={t('cabinetPage.valueProp.proofHint')}
						>
							<Suspense
								fallback={
									<textarea
										className={TEXTAREA_CLASS}
										value={valuePropForm.proof_points}
										onChange={(e) =>
											setValuePropForm((prev) => ({
												...prev,
												proof_points: e.target.value,
											}))
										}
										placeholder={t('cabinetPage.valueProp.phProof')}
									/>
								}
							>
								<SortableProofPointsField
									value={valuePropForm.proof_points}
									onChange={(v) =>
										setValuePropForm((prev) => ({ ...prev, proof_points: v }))
									}
									placeholder={t('cabinetPage.valueProp.phProof')}
								/>
							</Suspense>
						</FieldLabel>
						<FieldLabel label={t('cabinetPage.valueProp.fieldChannels')}>
							<textarea
								className={TEXTAREA_CLASS}
								value={valuePropForm.target_channels}
								onChange={(event) =>
									setValuePropForm((prev) => ({
										...prev,
										target_channels: event.target.value,
									}))
								}
								placeholder={t('cabinetPage.valueProp.phChannels')}
							/>
						</FieldLabel>
						<FieldLabel label={t('cabinetPage.valueProp.fieldStatus')}>
							<MarketingCabinetSelect
								value={valuePropForm.status}
								onChange={(v) =>
									setValuePropForm((prev) => ({ ...prev, status: v }))
								}
								options={valuePropInlineStatusOptions}
							/>
						</FieldLabel>
						<DesktopAppButton
							type="submit"
							variant="accent"
							disabled={!selectedProjectId || createValuePropMutation.isPending}
						>
							{createValuePropMutation.isPending ? (
								<ArrowPathIcon
									className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							) : (
								<MegaphoneIcon
									className="h-4 w-4"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							)}
							{t('cabinetPage.valueProp.submitCreate')}
						</DesktopAppButton>
					</form>
				</SectionPanel>

				<SectionPanel
					title={t('cabinetPage.valueProp.selectJtbdTitle')}
					description={t('cabinetPage.valueProp.selectJtbdDescription')}
					helpBlockId="value.select_jtbd"
				>
					{allJobStories.length > 0 ? (
						allJobStories.length > MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD ? (
							<VirtualVariableList
								items={allJobStories}
								estimateSize={() => 72}
								getItemKey={(index) =>
									allJobStories[index]?.id ?? `jtbd-pick-${index}`
								}
								height={360}
								overscanCount={6}
								className="rounded-(--desktop-radius)"
								renderItem={(job) => (
									<div className="pb-2">{renderJtbdPickLabel(job)}</div>
								)}
							/>
						) : (
							<div className="space-y-2">
								{allJobStories.map((job) => (
									<div key={job.id}>{renderJtbdPickLabel(job)}</div>
								))}
							</div>
						)
					) : (
						<DesktopAppEmptyState
							title={t('cabinetPage.valueProp.jtbdUnavailableTitle')}
							description={t(
								'cabinetPage.valueProp.jtbdUnavailableDescription'
							)}
						/>
					)}
				</SectionPanel>
			</div>
		</div>
	);
}
