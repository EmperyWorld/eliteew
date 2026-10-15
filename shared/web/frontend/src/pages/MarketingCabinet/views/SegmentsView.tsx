import { VirtualVariableList } from '@/components/shared/VirtualList';
import * as React from 'react';
import { useEffect, useId, useLayoutEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	ArrowPathIcon,
	SignalIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppErrorState,
	DesktopAppInput,
	DesktopAppSectionLabel,
	DesktopAppSurface,
} from '../../Desktop/components/DesktopAppChrome';
import { MarketingCabinetCheckboxPickList } from '../components/MarketingCabinetCheckboxPickList';
import { EmptyProjectState } from '../components/EmptyProjectState';
import { DocumentAutofillAction } from '../components/DocumentAutofillAction';
import { MarketingSectionGenerateAiButton } from '../components/MarketingSectionGenerateAiButton';
import { InputLabel } from '../components/FieldLabel';
import { LoadingGrid } from '../components/LoadingGrid';
import { MarketingCabinetSelect } from '../components/MarketingCabinetSelect';
import { SectionPanel } from '../components/SectionPanel';
import {
	INPUT_STACK_CLASS,
	MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD,
	MARKETING_SEGMENT_CARD_ESTIMATE_PX,
	TEXTAREA_CLASS,
} from '../constants';
import { useMarketingShellClasses } from '../hooks/useMarketingShellClasses';
import {
	marketingCabinetJobStoriesQueryOptions,
	marketingCabinetProjectDashboardInvalidationQueryKey,
	marketingCabinetProjectSectionInvalidationQueryKey,
	marketingCabinetSegmentsQueryOptions,
} from '../marketingCabinetQueryOptions';

import {
	marketingCabinetApi,
	type MarketingJobStory,
	type MarketingSegment,
} from '../marketingCabinetApi';
import {
	localizePriority,
	localizeSegmentType,
	localizeStatus,
} from '../locales';
import {
	MC_OPS_SEGMENT_PRIORITY,
	MC_OPS_SEGMENT_STATUS,
	MC_OPS_SEGMENT_TYPE,
} from '../operationsDeepLink';
import {
	extractApiErrorMessage,
	parseOptionalNumber,
	requireDefined,
} from '../utils';

interface SegmentFormState {
	name: string;
	description: string;
	segment_type: string;
	status: string;
	priority: string;
	estimated_reach: string;
	fit_score: string;
	pain_points: string;
	gains: string;
}

const initialForm: SegmentFormState = {
	name: '',
	description: '',
	segment_type: 'icp',
	status: 'draft',
	priority: 'medium',
	estimated_reach: '',
	fit_score: '',
	pain_points: '',
	gains: '',
};

function parseList(value: string): string[] {
	return value
		.split(/\n|,/)
		.map((item) => item.trim())
		.filter(Boolean);
}

const segmentBadgeClass =
	'inline-flex max-w-full shrink-0 items-center rounded-full border border-(--desktop-border-subtle) bg-(--desktop-surface-app)/50 px-2 py-0.5 text-[11px] font-medium text-(--desktop-text-secondary)';

export function SegmentsView({
	selectedProjectId,
	focusedEntityId = null,
	allowMarketingWrite = true,
}: {
	selectedProjectId: string | null;
	focusedEntityId?: string | null;
	allowMarketingWrite?: boolean;
}) {
	const { t } = useTranslation('marketing');
	const { checkboxControl } = useMarketingShellClasses();
	const segmentTypeOptions = [
		{ value: 'icp', label: t('segmentsView.segmentType.icp') },
		{ value: 'persona', label: t('segmentsView.segmentType.persona') },
		{
			value: 'account_cluster',
			label: t('segmentsView.segmentType.account_cluster'),
		},
		{
			value: 'channel_audience',
			label: t('segmentsView.segmentType.channel_audience'),
		},
	];
	const segmentStatusOptions = [
		{ value: 'draft', label: t('segmentsView.status.draft') },
		{ value: 'active', label: t('segmentsView.status.active') },
		{ value: 'review', label: t('segmentsView.status.review') },
		{ value: 'archived', label: t('segmentsView.status.archived') },
	];
	const segmentPriorityOptions = [
		{ value: 'low', label: t('segmentsView.priority.low') },
		{ value: 'medium', label: t('segmentsView.priority.medium') },
		{ value: 'high', label: t('segmentsView.priority.high') },
		{ value: 'urgent', label: t('segmentsView.priority.urgent') },
	];
	const uid = useId();
	const fid = {
		name: `${uid}-name`,
		type: `${uid}-type`,
		status: `${uid}-status`,
		priority: `${uid}-priority`,
		reach: `${uid}-reach`,
		fit: `${uid}-fit`,
		description: `${uid}-description`,
		jtbdGroup: `${uid}-jtbd`,
		pains: `${uid}-pains`,
		gains: `${uid}-gains`,
	};
	const queryClient = useQueryClient();
	const [form, setForm] = useState<SegmentFormState>(initialForm);
	const [selectedJobStoryIds, setSelectedJobStoryIds] = useState<string[]>([]);
	const [editingSegment, setEditingSegment] = useState<MarketingSegment | null>(
		null
	);

	const segmentsQuery = useQuery({
		...marketingCabinetSegmentsQueryOptions(selectedProjectId),
		enabled: Boolean(selectedProjectId),
	});
	const jobStoriesQuery = useQuery({
		...marketingCabinetJobStoriesQueryOptions(selectedProjectId),
		enabled: Boolean(selectedProjectId),
	});

	const createMutation = useMutation({
		mutationFn: () =>
			marketingCabinetApi.createSegment({
				project_id: requireDefined(selectedProjectId, 'selectedProjectId'),
				name: form.name.trim(),
				description: form.description.trim() || null,
				segment_type: form.segment_type,
				status: form.status,
				priority: form.priority,
				estimated_reach: Number(form.estimated_reach || 0),
				fit_score: parseOptionalNumber(form.fit_score),
				linked_job_story_ids: selectedJobStoryIds,
				pain_points: parseList(form.pain_points),
				gains: parseList(form.gains),
			}),
		onSuccess: () => {
			setForm(initialForm);
			setSelectedJobStoryIds([]);
			void queryClient.invalidateQueries({
				queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
					'segments',
					selectedProjectId
				),
			});
			void queryClient.invalidateQueries({
				queryKey:
					marketingCabinetProjectDashboardInvalidationQueryKey(
						selectedProjectId
					),
			});
		},
	});

	const updateMutation = useMutation({
		mutationFn: () => {
			if (!editingSegment) throw new Error('Segment not selected');
			return marketingCabinetApi.updateSegment(editingSegment.id, {
				name: form.name.trim(),
				description: form.description.trim() || null,
				segment_type: form.segment_type,
				status: form.status,
				priority: form.priority,
				estimated_reach: Number(form.estimated_reach || 0),
				fit_score: parseOptionalNumber(form.fit_score),
				linked_job_story_ids: selectedJobStoryIds,
				pain_points: parseList(form.pain_points),
				gains: parseList(form.gains),
			});
		},
		onSuccess: () => {
			setEditingSegment(null);
			setForm(initialForm);
			setSelectedJobStoryIds([]);
			void queryClient.invalidateQueries({
				queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
					'segments',
					selectedProjectId
				),
			});
			void queryClient.invalidateQueries({
				queryKey:
					marketingCabinetProjectDashboardInvalidationQueryKey(
						selectedProjectId
					),
			});
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (segmentId: string) =>
			marketingCabinetApi.deleteSegment(segmentId),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
					'segments',
					selectedProjectId
				),
			});
			void queryClient.invalidateQueries({
				queryKey:
					marketingCabinetProjectDashboardInvalidationQueryKey(
						selectedProjectId
					),
			});
		},
	});

	const isPending = createMutation.isPending || updateMutation.isPending;
	const availableJobs = jobStoriesQuery.data?.items ?? [];
	const segments = segmentsQuery.data?.items ?? [];
	const segmentsTotal = segmentsQuery.data?.total ?? segments.length;
	const segmentsTruncated = segmentsTotal > segments.length;

	const [segmentUrlTick, setSegmentUrlTick] = useState(0);
	useLayoutEffect(() => {
		setSegmentUrlTick((n) => n + 1);
	}, []);
	useEffect(() => {
		const onPop = () => setSegmentUrlTick((n) => n + 1);
		window.addEventListener('popstate', onPop);
		return () => window.removeEventListener('popstate', onPop);
	}, []);

	const dashboardSegmentFilters = useMemo(() => {
		void segmentUrlTick;
		if (typeof window === 'undefined') {
			return { segment_type: '', status: '', priority: '' };
		}
		const p = new URLSearchParams(window.location.search);
		return {
			segment_type: p.get(MC_OPS_SEGMENT_TYPE)?.trim() ?? '',
			status: p.get(MC_OPS_SEGMENT_STATUS)?.trim() ?? '',
			priority: p.get(MC_OPS_SEGMENT_PRIORITY)?.trim() ?? '',
		};
	}, [segmentUrlTick]);

	const setSegmentUrlFilter = React.useCallback(
		(key: string, value: string) => {
			if (typeof window === 'undefined') return;
			const url = new URL(window.location.href);
			const v = value.trim();
			if (v) url.searchParams.set(key, v);
			else url.searchParams.delete(key);
			window.history.replaceState({}, '', url.toString());
			setSegmentUrlTick((n) => n + 1);
		},
		[]
	);

	const filteredSegments = useMemo(() => {
		let r = segments;
		const { segment_type, status, priority } = dashboardSegmentFilters;
		if (!segment_type && !status && !priority) return r;
		if (segment_type) {
			r = r.filter(
				(x) =>
					String(x.segment_type || '').toLowerCase() ===
					segment_type.toLowerCase()
			);
		}
		if (status) {
			r = r.filter(
				(x) => String(x.status || '').toLowerCase() === status.toLowerCase()
			);
		}
		if (priority) {
			r = r.filter(
				(x) => String(x.priority || '').toLowerCase() === priority.toLowerCase()
			);
		}
		return r;
	}, [segments, dashboardSegmentFilters]);

	const selectedJobs = useMemo(
		() => new Set(selectedJobStoryIds),
		[selectedJobStoryIds]
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

	function hydrateForm(segment: MarketingSegment) {
		setEditingSegment(segment);
		setForm({
			name: segment.name,
			description: segment.description || '',
			segment_type: segment.segment_type || 'icp',
			status: segment.status || 'draft',
			priority: segment.priority || 'medium',
			estimated_reach: String(segment.estimated_reach || ''),
			fit_score: segment.fit_score != null ? String(segment.fit_score) : '',
			pain_points: (segment.pain_points ?? []).join('\n'),
			gains: (segment.gains ?? []).join('\n'),
		});
		setSelectedJobStoryIds(segment.linked_job_story_ids ?? []);
	}

	function resetForm() {
		setEditingSegment(null);
		setForm(initialForm);
		setSelectedJobStoryIds([]);
	}

	function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!selectedProjectId || !form.name.trim()) return;
		if (editingSegment) {
			void updateMutation.mutateAsync();
			return;
		}
		void createMutation.mutateAsync();
	}

	const renderSegmentListCard = (segment: MarketingSegment) => (
		<li className="min-w-0 list-none">
			<DesktopAppSurface
				variant="soft"
				data-marketing-entity-id={segment.id}
				className={cn(
					'min-w-0 space-y-3 overflow-hidden p-3 sm:p-4',
					focusedEntityId === segment.id &&
						'ring-2 ring-(--mc-accent-60) ring-offset-2 ring-offset-(--desktop-surface-app)'
				)}
			>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
					<div className="min-w-0 flex-1 space-y-2">
						<h3 className="text-base font-semibold leading-snug text-(--desktop-text-primary) wrap-break-word">
							{segment.name}
						</h3>
						<div className="flex flex-wrap gap-1.5">
							<span className={segmentBadgeClass}>
								{localizeSegmentType(segment.segment_type || 'icp')}
							</span>
							<span className={segmentBadgeClass}>
								{localizeStatus(segment.status)}
							</span>
							<span className={segmentBadgeClass}>
								{localizePriority(segment.priority)}
							</span>
						</div>
					</div>
					<div className="flex shrink-0 items-center justify-end gap-2 border-t border-(--desktop-border-subtle) pt-3 sm:border-t-0 sm:pt-0">
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							className="min-h-10 min-w-18 sm:min-h-0"
							onClick={() => hydrateForm(segment)}
						>
							{t('common.edit')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="icon"
							className="min-h-10 min-w-10 sm:min-h-0 sm:min-w-0"
							disabled={
								deleteMutation.isPending &&
								deleteMutation.variables === segment.id
							}
							onClick={() => deleteMutation.mutate(segment.id)}
							aria-label={t('segmentsView.deleteAria', {
								name: segment.name,
							})}
						>
							<TrashIcon
								className="h-4 w-4"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						</DesktopAppButton>
					</div>
				</div>
				{segment.description ? (
					<p className="border-t border-(--desktop-border-subtle) pt-3 text-sm leading-relaxed text-(--desktop-text-secondary)">
						{segment.description}
					</p>
				) : null}
				<dl className="grid grid-cols-1 gap-3 border-t border-(--desktop-border-subtle) pt-3 sm:grid-cols-3 sm:gap-4">
					<div className="min-w-0">
						<dt
							className={cn(
								DESKTOP_APP_STYLE_CONTRACT.sectionLabel,
								'font-medium'
							)}
						>
							{t('segmentsView.fieldReach')}
						</dt>
						<dd className="mt-0.5 text-sm font-semibold tabular-nums text-(--desktop-text-primary)">
							{segment.estimated_reach ?? 0}
						</dd>
					</div>
					<div className="min-w-0">
						<dt
							className={cn(
								DESKTOP_APP_STYLE_CONTRACT.sectionLabel,
								'font-medium'
							)}
						>
							{t('segmentsView.fieldFit')}
						</dt>
						<dd className="mt-0.5 text-sm font-semibold tabular-nums text-(--desktop-text-primary)">
							{segment.fit_score ?? t('common.na')}
						</dd>
					</div>
					<div className="min-w-0">
						<dt
							className={cn(
								DESKTOP_APP_STYLE_CONTRACT.sectionLabel,
								'font-medium'
							)}
						>
							{t('segmentsView.fieldJtbd')}
						</dt>
						<dd className="mt-0.5 text-sm font-semibold tabular-nums text-(--desktop-text-primary)">
							{(segment.linked_job_story_ids ?? []).length}
						</dd>
					</div>
				</dl>
				<div className="grid gap-4 border-t border-(--desktop-border-subtle) pt-3 sm:grid-cols-2">
					<div className="min-w-0">
						<DesktopAppSectionLabel>
							{t('segmentsView.painsLabel')}
						</DesktopAppSectionLabel>
						{(segment.pain_points ?? []).length > 0 ? (
							<ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-(--desktop-text-secondary) marker:text-(--desktop-text-muted)">
								{(segment.pain_points ?? []).map((item) => (
									<li key={item} className="wrap-break-word pl-0.5">
										{item}
									</li>
								))}
							</ul>
						) : (
							<p
								className={cn(
									DESKTOP_TYPOGRAPHY.meta,
									'mt-2 rounded-md border border-dashed border-(--desktop-border-subtle) bg-(--desktop-surface-app)/25 px-3 py-3 text-center'
								)}
							>
								{t('common.notListed')}
							</p>
						)}
					</div>
					<div className="min-w-0">
						<DesktopAppSectionLabel>
							{t('segmentsView.gainsLabel')}
						</DesktopAppSectionLabel>
						{(segment.gains ?? []).length > 0 ? (
							<ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-(--desktop-text-secondary) marker:text-(--desktop-text-muted)">
								{(segment.gains ?? []).map((item) => (
									<li key={item} className="wrap-break-word pl-0.5">
										{item}
									</li>
								))}
							</ul>
						) : (
							<p
								className={cn(
									DESKTOP_TYPOGRAPHY.meta,
									'mt-2 rounded-md border border-dashed border-(--desktop-border-subtle) bg-(--desktop-surface-app)/25 px-3 py-3 text-center'
								)}
							>
								{t('common.notListed')}
							</p>
						)}
					</div>
				</div>
			</DesktopAppSurface>
		</li>
	);
	if (!selectedProjectId) {
		return (
			<EmptyProjectState
				title={t('common.pickProjectTitle')}
				description={t('segmentsView.emptyProjectDescription')}
			/>
		);
	}

	return (
		<div className="grid min-w-0 gap-4 sm:gap-5 xl:grid-cols-[1.1fr_0.9fr]">
			<SectionPanel
				title={t('segmentsView.panelListTitle')}
				description={t('segmentsView.panelListDescription')}
				helpBlockId="overview.metric.readiness"
				actions={
					<div className="flex flex-wrap items-center gap-2">
						{allowMarketingWrite ? (
							<MarketingSectionGenerateAiButton
								projectId={selectedProjectId}
								targetSection="segments"
								allowMarketingWrite={allowMarketingWrite}
								invalidateQueryKeys={[
									marketingCabinetProjectSectionInvalidationQueryKey(
										'segments',
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
							targetSection="segments"
							targetLabel={t('segmentsView.docAutofillLabel')}
							invalidateQueryKeys={[
								marketingCabinetProjectSectionInvalidationQueryKey(
									'segments',
									selectedProjectId
								),
								marketingCabinetProjectDashboardInvalidationQueryKey(
									selectedProjectId
								),
							]}
						/>
					</div>
				}
			>
				{segmentsQuery.isLoading ? (
					<LoadingGrid />
				) : segmentsQuery.isError ? (
					<DesktopAppErrorState
						message={extractApiErrorMessage(
							segmentsQuery.error,
							t('segmentsView.loadErrorDefault')
						)}
						onAction={() => void segmentsQuery.refetch()}
					/>
				) : segments.length > 0 ? (
					<ul
						className="space-y-3 sm:space-y-4"
						aria-label={t('segmentsView.panelListTitle')}
					>
						<li className="list-none">
							<div className="mb-3 flex flex-wrap gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle)/80 bg-(--desktop-surface-soft)/40 p-2 sm:mb-4">
								<div className="min-w-36 flex-1">
									<MarketingCabinetSelect
										size="compact"
										value={dashboardSegmentFilters.segment_type}
										aria-label={t(
											'overview.dashboard.listFilter.segmentTypeAria'
										)}
										options={[
											{
												value: '',
												label: t('overview.dashboard.listFilter.all'),
											},
											...segmentTypeOptions,
										]}
										onChange={(v) =>
											setSegmentUrlFilter(MC_OPS_SEGMENT_TYPE, v)
										}
									/>
								</div>
								<div className="min-w-36 flex-1">
									<MarketingCabinetSelect
										size="compact"
										value={dashboardSegmentFilters.status}
										aria-label={t(
											'overview.dashboard.listFilter.segmentStatusAria'
										)}
										options={[
											{
												value: '',
												label: t('overview.dashboard.listFilter.all'),
											},
											...segmentStatusOptions,
										]}
										onChange={(v) =>
											setSegmentUrlFilter(MC_OPS_SEGMENT_STATUS, v)
										}
									/>
								</div>
								<div className="min-w-36 flex-1">
									<MarketingCabinetSelect
										size="compact"
										value={dashboardSegmentFilters.priority}
										aria-label={t(
											'overview.dashboard.listFilter.segmentPriorityAria'
										)}
										options={[
											{
												value: '',
												label: t('overview.dashboard.listFilter.all'),
											},
											...segmentPriorityOptions,
										]}
										onChange={(v) =>
											setSegmentUrlFilter(MC_OPS_SEGMENT_PRIORITY, v)
										}
									/>
								</div>
							</div>
						</li>
						<li className="list-none">
							<p className={cn('mc-meta-caption', DESKTOP_TYPOGRAPHY.meta)}>
								{segmentsTruncated
									? t('cabinetPage.listFetchSummaryTruncated', {
											shown: segments.length,
											total: segmentsTotal,
										})
									: t('cabinetPage.listFetchSummaryAll', {
											count: filteredSegments.length,
										})}
							</p>
						</li>
						{filteredSegments.length === 0 ? (
							<li className="list-none">
								<DesktopAppEmptyState
									title={t('segmentsView.filteredEmptyTitle')}
									description={t('segmentsView.filteredEmptyDescription')}
								/>
							</li>
						) : null}
						{filteredSegments.length >
						MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD ? (
							<li className="list-none">
								<VirtualVariableList
									items={filteredSegments}
									estimateSize={() => MARKETING_SEGMENT_CARD_ESTIMATE_PX}
									getItemKey={(index) =>
										filteredSegments[index]?.id ?? `segment-${index}`
									}
									height={520}
									overscanCount={4}
									className="rounded-(--desktop-radius)"
									renderItem={(segment) => (
										<div className="pb-3 sm:pb-4">
											{renderSegmentListCard(segment)}
										</div>
									)}
								/>
							</li>
						) : (
							filteredSegments.map((segment) => renderSegmentListCard(segment))
						)}
					</ul>
				) : (
					<div className="rounded-(--desktop-radius-lg) border border-dashed border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40">
						<DesktopAppEmptyState
							className="px-4 py-10 sm:py-12"
							icon={
								<SignalIcon
									className="h-8 w-8 text-(--desktop-text-muted)"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							}
							title={t('segmentsView.emptyListTitle')}
							description={t('segmentsView.emptyListDescription')}
						/>
					</div>
				)}
			</SectionPanel>

			<SectionPanel
				title={
					editingSegment
						? t('segmentsView.formEditTitle')
						: t('segmentsView.formNewTitle')
				}
				description={t('segmentsView.formDescription')}
			>
				<form
					className="min-w-0 space-y-4"
					onSubmit={handleSubmit}
					aria-busy={isPending}
				>
					<div className={INPUT_STACK_CLASS}>
						<div className="space-y-2">
							<InputLabel htmlFor={fid.name} required>
								{t('segmentsView.fieldName')}
							</InputLabel>
							<DesktopAppInput
								id={fid.name}
								value={form.name}
								onChange={(event) =>
									setForm((prev) => ({ ...prev, name: event.target.value }))
								}
								placeholder={t('segmentsView.phName')}
							/>
						</div>
						<div className="space-y-2">
							<InputLabel htmlFor={fid.type}>
								{t('segmentsView.fieldType')}
							</InputLabel>
							<MarketingCabinetSelect
								id={fid.type}
								value={form.segment_type}
								onChange={(segment_type) =>
									setForm((prev) => ({ ...prev, segment_type }))
								}
								options={segmentTypeOptions}
							/>
						</div>
					</div>
					<div className={INPUT_STACK_CLASS}>
						<div className="space-y-2">
							<InputLabel htmlFor={fid.status}>
								{t('segmentsView.fieldStatus')}
							</InputLabel>
							<MarketingCabinetSelect
								id={fid.status}
								value={form.status}
								onChange={(status) => setForm((prev) => ({ ...prev, status }))}
								options={segmentStatusOptions}
							/>
						</div>
						<div className="space-y-2">
							<InputLabel htmlFor={fid.priority}>
								{t('segmentsView.fieldPriority')}
							</InputLabel>
							<MarketingCabinetSelect
								id={fid.priority}
								value={form.priority}
								onChange={(priority) =>
									setForm((prev) => ({ ...prev, priority }))
								}
								options={segmentPriorityOptions}
							/>
						</div>
					</div>
					<div className={INPUT_STACK_CLASS}>
						<div className="space-y-2">
							<InputLabel htmlFor={fid.reach}>
								{t('segmentsView.fieldReach')}
							</InputLabel>
							<DesktopAppInput
								id={fid.reach}
								value={form.estimated_reach}
								onChange={(event) =>
									setForm((prev) => ({
										...prev,
										estimated_reach: event.target.value,
									}))
								}
								placeholder={t('segmentsView.phReach')}
							/>
						</div>
						<div className="space-y-2">
							<InputLabel htmlFor={fid.fit}>
								{t('segmentsView.fieldFit')}
							</InputLabel>
							<DesktopAppInput
								id={fid.fit}
								value={form.fit_score}
								onChange={(event) =>
									setForm((prev) => ({
										...prev,
										fit_score: event.target.value,
									}))
								}
								placeholder={t('segmentsView.phFit')}
							/>
						</div>
					</div>
					<div className="space-y-2">
						<InputLabel htmlFor={fid.description}>
							{t('segmentsView.fieldDescription')}
						</InputLabel>
						<textarea
							id={fid.description}
							className={TEXTAREA_CLASS}
							value={form.description}
							onChange={(event) =>
								setForm((prev) => ({
									...prev,
									description: event.target.value,
								}))
							}
							placeholder={t('segmentsView.phDescription')}
						/>
					</div>
					<div className="space-y-2">
						<InputLabel id={fid.jtbdGroup}>
							{t('segmentsView.fieldJtbd')}
						</InputLabel>
						{jobStoriesQuery.isLoading ? (
							<div
								className={cn(
									DESKTOP_TYPOGRAPHY.meta,
									'rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/40 px-4 py-6 text-center'
								)}
								role="status"
								aria-busy="true"
							>
								{t('segmentsView.loadingJtbd')}
							</div>
						) : (availableJobs ?? []).length > 0 ? (
							<fieldset
								aria-labelledby={fid.jtbdGroup}
								className="m-0 min-w-0 rounded-(--desktop-radius) border border-(--desktop-border-subtle) p-2 sm:p-3"
							>
								<MarketingCabinetCheckboxPickList
									items={availableJobs as MarketingJobStory[]}
									getLabel={(job) => job.title}
									selectedIds={selectedJobs}
									checkboxClassName={checkboxControl}
									onToggle={(id, checked) => {
										setSelectedJobStoryIds((current) =>
											checked
												? [...current, id]
												: current.filter((itemId) => itemId !== id)
										);
									}}
								/>
							</fieldset>
						) : (
							<div
								className={cn(
									DESKTOP_TYPOGRAPHY.meta,
									'rounded-(--desktop-radius) border border-dashed border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/30 px-4 py-6 text-center leading-relaxed'
								)}
							>
								{t('segmentsView.addJtbdFirst')}
							</div>
						)}
					</div>
					<div className="space-y-2">
						<InputLabel htmlFor={fid.pains}>
							{t('segmentsView.fieldPains')}
						</InputLabel>
						<textarea
							id={fid.pains}
							className={TEXTAREA_CLASS}
							value={form.pain_points}
							onChange={(event) =>
								setForm((prev) => ({
									...prev,
									pain_points: event.target.value,
								}))
							}
							placeholder={t('segmentsView.phPains')}
						/>
					</div>
					<div className="space-y-2">
						<InputLabel htmlFor={fid.gains}>
							{t('segmentsView.fieldGains')}
						</InputLabel>
						<textarea
							id={fid.gains}
							className={TEXTAREA_CLASS}
							value={form.gains}
							onChange={(event) =>
								setForm((prev) => ({ ...prev, gains: event.target.value }))
							}
							placeholder={t('segmentsView.phGains')}
						/>
					</div>
					{createMutation.isError || updateMutation.isError ? (
						<DesktopAppErrorState
							message={extractApiErrorMessage(
								createMutation.error || updateMutation.error,
								t('segmentsView.saveErrorDefault')
							)}
						/>
					) : null}
					<div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
						{editingSegment ? (
							<DesktopAppButton
								type="button"
								variant="ghost"
								className="w-full min-h-11 sm:w-auto sm:min-h-0"
								onClick={resetForm}
							>
								{t('common.cancel')}
							</DesktopAppButton>
						) : null}
						<DesktopAppButton
							type="submit"
							variant="accent"
							className="w-full min-h-11 sm:w-auto sm:min-h-0"
							disabled={isPending || !form.name.trim()}
						>
							{isPending ? (
								<ArrowPathIcon
									className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							) : null}
							{editingSegment
								? t('segmentsView.submitSave')
								: t('segmentsView.submitCreate')}
						</DesktopAppButton>
					</div>
				</form>
			</SectionPanel>
		</div>
	);
}
