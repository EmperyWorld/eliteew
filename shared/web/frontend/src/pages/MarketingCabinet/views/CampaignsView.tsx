/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Marketing cabinet campaigns section: list, filters, CRUD form, and links to segments/VP.
 *
 * Invariants:
 * - Campaign list fetch is capped (see MARKETING_CAMPAIGNS_LIST_LIMIT); large lists use virtualization.
 * - Segment/VP pickers share TanStack keys with other sections (`MARKETING_SECTION_LIST_FETCH_LIMIT`).
 * - Mutations invalidate campaigns and project-dashboard query keys for the active project.
 *
 * Related:
 * - constants.ts (MARKETING_CAMPAIGNS_LIST_LIMIT)
 * - documentation/product/marketing/MARKETING-CABINET.md
 */
import * as React from 'react';
import { useEffect, useId, useLayoutEffect, useMemo, useState } from 'react';
import { VirtualVariableList } from '@/components/shared/VirtualList';
import { useTranslation } from 'react-i18next';
import {
	ArrowPathIcon,
	MegaphoneIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { MarketingCabinetCheckboxPickList } from '../components/MarketingCabinetCheckboxPickList';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppErrorState,
	DesktopAppInput,
	DesktopAppSurface,
} from '../../Desktop/components/DesktopAppChrome';
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
	TEXTAREA_CLASS,
} from '../constants';
import { useMarketingShellClasses } from '../hooks/useMarketingShellClasses';
import {
	marketingCabinetCampaignsQueryOptions,
	marketingCabinetProjectDashboardInvalidationQueryKey,
	marketingCabinetProjectSectionInvalidationQueryKey,
	marketingCabinetSegmentsQueryOptions,
	marketingCabinetValuePropsQueryOptions,
} from '../marketingCabinetQueryOptions';

import {
	marketingCabinetApi,
	type MarketingCampaign,
	type MarketingSegment,
	type MarketingValueProposition,
} from '../marketingCabinetApi';
import {
	localizeCampaignChannel,
	localizePriority,
	localizeStatus,
} from '../locales';
import {
	MC_OPS_CAMPAIGN_CHANNEL,
	MC_OPS_CAMPAIGN_PRIORITY,
	MC_OPS_CAMPAIGN_STATUS,
} from '../operationsDeepLink';
import {
	extractApiErrorMessage,
	parseOptionalNumber,
	requireDefined,
} from '../utils';

const CAMPAIGN_BADGE_BASE =
	'inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset';

function campaignStatusBadgeClass(status: string | null | undefined): string {
	const s = (status || 'draft').toLowerCase();
	switch (s) {
		case 'active':
			return `${CAMPAIGN_BADGE_BASE} ring-[color-mix(in_srgb,var(--mc-accent)_42%,transparent)] bg-[color-mix(in_srgb,var(--mc-accent)_12%,transparent)] text-(--desktop-text-primary)`;
		case 'paused':
			return `${CAMPAIGN_BADGE_BASE} ring-amber-400/40 bg-amber-400/10 text-amber-100/95`;
		case 'completed':
			return `${CAMPAIGN_BADGE_BASE} ring-[var(--glass-border)]/50 bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.06)_100%,transparent)] backdrop-blur-sm text-(--desktop-text-secondary)`;
		default:
			return `${CAMPAIGN_BADGE_BASE} ring-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-muted)`;
	}
}

function campaignPriorityBadgeClass(
	priority: string | null | undefined
): string {
	const p = (priority || 'medium').toLowerCase();
	const base = `${CAMPAIGN_BADGE_BASE} bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.06)_100%,transparent)] backdrop-blur-sm`;
	switch (p) {
		case 'urgent':
			return `${base} ring-red-400/35 text-red-100/95`;
		case 'high':
			return `${base} ring-orange-400/35 text-orange-100/95`;
		case 'low':
			return `${base} ring-(--desktop-border-subtle) text-(--desktop-text-muted)`;
		default:
			return `${base} ring-(--desktop-border-subtle) text-(--desktop-text-secondary)`;
	}
}

function campaignChannelBadgeClass(): string {
	return 'inline-flex max-w-full items-center rounded-full border border-[var(--glass-border)]/40 bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.05)_100%,transparent)] backdrop-blur-sm px-2.5 py-0.5 text-[11px] font-medium text-(--desktop-text-secondary)';
}

interface CampaignFormState {
	name: string;
	objective: string;
	channel: string;
	status: string;
	priority: string;
	owner_name: string;
	hypothesis: string;
	budget: string;
	target_metric_name: string;
	target_metric: string;
	actual_metric: string;
}

const initialForm: CampaignFormState = {
	name: '',
	objective: '',
	channel: 'organic',
	status: 'draft',
	priority: 'medium',
	owner_name: '',
	hypothesis: '',
	budget: '',
	target_metric_name: '',
	target_metric: '',
	actual_metric: '',
};

export function CampaignsView({
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
	const channelOptions = [
		{ value: 'organic', label: t('campaignsView.channel.organic') },
		{ value: 'seo', label: t('campaignsView.channel.seo') },
		{ value: 'paid_search', label: t('campaignsView.channel.paid_search') },
		{ value: 'email', label: t('campaignsView.channel.email') },
		{ value: 'partner', label: t('campaignsView.channel.partner') },
		{ value: 'social', label: t('campaignsView.channel.social') },
	];
	const campaignStatusOptions = [
		{ value: 'draft', label: t('campaignsView.status.draft') },
		{ value: 'active', label: t('campaignsView.status.active') },
		{ value: 'paused', label: t('campaignsView.status.paused') },
		{ value: 'completed', label: t('campaignsView.status.completed') },
	];
	const campaignPriorityOptions = [
		{ value: 'low', label: t('campaignsView.priority.low') },
		{ value: 'medium', label: t('campaignsView.priority.medium') },
		{ value: 'high', label: t('campaignsView.priority.high') },
		{ value: 'urgent', label: t('campaignsView.priority.urgent') },
	];
	const uid = useId();
	const fid = {
		name: `${uid}-name`,
		channel: `${uid}-channel`,
		status: `${uid}-status`,
		priority: `${uid}-priority`,
		objective: `${uid}-objective`,
		hypothesis: `${uid}-hypothesis`,
		owner: `${uid}-owner`,
		budget: `${uid}-budget`,
		kpiName: `${uid}-kpi-name`,
		kpiTarget: `${uid}-kpi-target`,
		kpiActual: `${uid}-kpi-actual`,
		segGroup: `${uid}-seg-group`,
		vpGroup: `${uid}-vp-group`,
	};
	const queryClient = useQueryClient();
	const [form, setForm] = useState<CampaignFormState>(initialForm);
	const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);
	const [selectedValuePropIds, setSelectedValuePropIds] = useState<string[]>(
		[]
	);
	const [editingCampaign, setEditingCampaign] =
		useState<MarketingCampaign | null>(null);

	const campaignsQuery = useQuery({
		...marketingCabinetCampaignsQueryOptions(selectedProjectId),
		enabled: Boolean(selectedProjectId),
	});
	const segmentsQuery = useQuery({
		...marketingCabinetSegmentsQueryOptions(selectedProjectId),
		enabled: Boolean(selectedProjectId),
	});
	const valuePropsQuery = useQuery({
		...marketingCabinetValuePropsQueryOptions(selectedProjectId),
		enabled: Boolean(selectedProjectId),
	});

	const createMutation = useMutation({
		mutationFn: () =>
			marketingCabinetApi.createCampaign({
				project_id: requireDefined(selectedProjectId, 'selectedProjectId'),
				name: form.name.trim(),
				objective: form.objective.trim() || null,
				channel: form.channel,
				status: form.status,
				priority: form.priority,
				owner_name: form.owner_name.trim() || null,
				hypothesis: form.hypothesis.trim() || null,
				budget: parseOptionalNumber(form.budget),
				target_metric_name: form.target_metric_name.trim() || null,
				target_metric: parseOptionalNumber(form.target_metric),
				actual_metric: parseOptionalNumber(form.actual_metric),
				linked_segment_ids: selectedSegmentIds,
				linked_value_prop_ids: selectedValuePropIds,
			}),
		onSuccess: () => {
			resetForm();
			void queryClient.invalidateQueries({
				queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
					'campaigns',
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
			if (!editingCampaign) throw new Error('Campaign not selected');
			return marketingCabinetApi.updateCampaign(editingCampaign.id, {
				name: form.name.trim(),
				objective: form.objective.trim() || null,
				channel: form.channel,
				status: form.status,
				priority: form.priority,
				owner_name: form.owner_name.trim() || null,
				hypothesis: form.hypothesis.trim() || null,
				budget: parseOptionalNumber(form.budget),
				target_metric_name: form.target_metric_name.trim() || null,
				target_metric: parseOptionalNumber(form.target_metric),
				actual_metric: parseOptionalNumber(form.actual_metric),
				linked_segment_ids: selectedSegmentIds,
				linked_value_prop_ids: selectedValuePropIds,
			});
		},
		onSuccess: () => {
			resetForm();
			void queryClient.invalidateQueries({
				queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
					'campaigns',
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
		mutationFn: (campaignId: string) =>
			marketingCabinetApi.deleteCampaign(campaignId),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
					'campaigns',
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
	const campaigns = campaignsQuery.data?.items ?? [];
	const campaignsTotal = campaignsQuery.data?.total ?? campaigns.length;
	const campaignsTruncated = campaignsTotal > campaigns.length;

	const [campaignUrlTick, setCampaignUrlTick] = useState(0);
	useLayoutEffect(() => {
		setCampaignUrlTick((n) => n + 1);
	}, []);
	useEffect(() => {
		const onPop = () => setCampaignUrlTick((n) => n + 1);
		window.addEventListener('popstate', onPop);
		return () => window.removeEventListener('popstate', onPop);
	}, []);

	const dashboardCampaignFilters = useMemo(() => {
		void campaignUrlTick;
		if (typeof window === 'undefined') {
			return { status: '', channel: '', priority: '' };
		}
		const p = new URLSearchParams(window.location.search);
		return {
			status: p.get(MC_OPS_CAMPAIGN_STATUS)?.trim() ?? '',
			channel: p.get(MC_OPS_CAMPAIGN_CHANNEL)?.trim() ?? '',
			priority: p.get(MC_OPS_CAMPAIGN_PRIORITY)?.trim() ?? '',
		};
	}, [campaignUrlTick]);

	const setCampaignUrlFilter = React.useCallback(
		(key: string, value: string) => {
			if (typeof window === 'undefined') return;
			const url = new URL(window.location.href);
			const v = value.trim();
			if (v) url.searchParams.set(key, v);
			else url.searchParams.delete(key);
			window.history.replaceState({}, '', url.toString());
			setCampaignUrlTick((n) => n + 1);
		},
		[]
	);

	const filteredCampaigns = useMemo(() => {
		let r = campaigns;
		const { status, channel, priority } = dashboardCampaignFilters;
		if (!status && !channel && !priority) return r;
		if (status) {
			r = r.filter(
				(x) => String(x.status || '').toLowerCase() === status.toLowerCase()
			);
		}
		if (channel) {
			r = r.filter(
				(x) => String(x.channel || '').toLowerCase() === channel.toLowerCase()
			);
		}
		if (priority) {
			r = r.filter(
				(x) => String(x.priority || '').toLowerCase() === priority.toLowerCase()
			);
		}
		return r;
	}, [campaigns, dashboardCampaignFilters]);

	const availableSegments = segmentsQuery.data?.items ?? [];
	const availableValueProps = valuePropsQuery.data?.items ?? [];
	const selectedSegments = useMemo(
		() => new Set(selectedSegmentIds),
		[selectedSegmentIds]
	);
	const selectedValueProps = useMemo(
		() => new Set(selectedValuePropIds),
		[selectedValuePropIds]
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

	function resetForm() {
		setForm(initialForm);
		setSelectedSegmentIds([]);
		setSelectedValuePropIds([]);
		setEditingCampaign(null);
	}

	function hydrateForm(campaign: MarketingCampaign) {
		setEditingCampaign(campaign);
		setForm({
			name: campaign.name,
			objective: campaign.objective || '',
			channel: campaign.channel || 'organic',
			status: campaign.status || 'draft',
			priority: campaign.priority || 'medium',
			owner_name: campaign.owner_name || '',
			hypothesis: campaign.hypothesis || '',
			budget: campaign.budget != null ? String(campaign.budget) : '',
			target_metric_name: campaign.target_metric_name || '',
			target_metric:
				campaign.target_metric != null ? String(campaign.target_metric) : '',
			actual_metric:
				campaign.actual_metric != null ? String(campaign.actual_metric) : '',
		});
		setSelectedSegmentIds(campaign.linked_segment_ids ?? []);
		setSelectedValuePropIds(campaign.linked_value_prop_ids ?? []);
	}

	function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!selectedProjectId || !form.name.trim()) return;
		if (editingCampaign) {
			void updateMutation.mutateAsync();
			return;
		}
		void createMutation.mutateAsync();
	}

	const renderCampaignCard = (campaign: MarketingCampaign) => (
		<DesktopAppSurface
			variant="soft"
			data-marketing-entity-id={campaign.id}
			className={`space-y-3 p-4 transition-shadow ${focusedEntityId === campaign.id ? 'ring-1 ring-(--mc-accent-60)' : ''}`}
		>
			<div className="flex items-start justify-between gap-3">
				<h3 className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug text-(--desktop-text-primary)">
					{campaign.name}
				</h3>
				<div className="flex shrink-0 items-center gap-1">
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="sm"
						className="shrink-0"
						onClick={() => hydrateForm(campaign)}
					>
						{t('common.edit')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="icon"
						className="shrink-0"
						onClick={() => deleteMutation.mutate(campaign.id)}
						aria-label={t('campaignsView.deleteAria', {
							name: campaign.name,
						})}
					>
						<TrashIcon
							className="h-4 w-4"
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					</DesktopAppButton>
				</div>
			</div>
			<div className="flex flex-wrap items-center gap-1.5">
				<span className={campaignChannelBadgeClass()}>
					{localizeCampaignChannel(campaign.channel || 'organic')}
				</span>
				<span className={campaignStatusBadgeClass(campaign.status)}>
					{localizeStatus(campaign.status)}
				</span>
				<span className={campaignPriorityBadgeClass(campaign.priority)}>
					{localizePriority(campaign.priority)}
				</span>
			</div>
			{campaign.objective ? (
				<p className="text-sm leading-relaxed text-(--desktop-text-secondary)">
					{campaign.objective}
				</p>
			) : null}
			{campaign.hypothesis ? (
				<div className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-app)/40 p-3 text-xs leading-5 text-(--desktop-text-secondary)">
					{campaign.hypothesis}
				</div>
			) : null}
			<div
				className={cn(
					DESKTOP_TYPOGRAPHY.meta,
					'border-t border-(--desktop-border-subtle) pt-3 leading-5'
				)}
			>
				{t('campaignsView.kpiSummary', {
					kpiName: campaign.target_metric_name || t('common.metricNotSet'),
					target: campaign.target_metric ?? t('common.na'),
					actual: campaign.actual_metric ?? t('common.na'),
					segCount: campaign.linked_segment_ids?.length ?? 0,
					vpCount: campaign.linked_value_prop_ids?.length ?? 0,
				})}
			</div>
		</DesktopAppSurface>
	);

	if (!selectedProjectId) {
		return (
			<EmptyProjectState
				title={t('common.pickProjectTitle')}
				description={t('campaignsView.emptyProjectDescription')}
			/>
		);
	}

	return (
		<div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
			<SectionPanel
				title={t('campaignsView.panelListTitle')}
				description={t('campaignsView.panelListDescription')}
				actions={
					<div className="flex flex-wrap items-center gap-2">
						{allowMarketingWrite ? (
							<MarketingSectionGenerateAiButton
								projectId={selectedProjectId}
								targetSection="campaigns"
								allowMarketingWrite={allowMarketingWrite}
								invalidateQueryKeys={[
									marketingCabinetProjectSectionInvalidationQueryKey(
										'campaigns',
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
							targetSection="campaigns"
							targetLabel={t('campaignsView.docAutofillLabel')}
							invalidateQueryKeys={[
								marketingCabinetProjectSectionInvalidationQueryKey(
									'campaigns',
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
				{campaignsQuery.isLoading ? (
					<LoadingGrid />
				) : campaignsQuery.isError ? (
					<DesktopAppErrorState
						message={extractApiErrorMessage(
							campaignsQuery.error,
							t('campaignsView.loadErrorDefault')
						)}
						onAction={() => void campaignsQuery.refetch()}
					/>
				) : campaigns.length > 0 ? (
					<div className="space-y-3">
						<div className="flex flex-wrap gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle)/80 bg-(--desktop-surface-soft)/40 p-2">
							<div className="min-w-36 flex-1">
								<MarketingCabinetSelect
									size="compact"
									value={dashboardCampaignFilters.status}
									aria-label={t(
										'overview.dashboard.listFilter.campaignStatusAria'
									)}
									options={[
										{
											value: '',
											label: t('overview.dashboard.listFilter.all'),
										},
										...campaignStatusOptions,
									]}
									onChange={(v) =>
										setCampaignUrlFilter(MC_OPS_CAMPAIGN_STATUS, v)
									}
								/>
							</div>
							<div className="min-w-36 flex-1">
								<MarketingCabinetSelect
									size="compact"
									value={dashboardCampaignFilters.channel}
									aria-label={t(
										'overview.dashboard.listFilter.campaignChannelAria'
									)}
									options={[
										{
											value: '',
											label: t('overview.dashboard.listFilter.all'),
										},
										...channelOptions,
									]}
									onChange={(v) =>
										setCampaignUrlFilter(MC_OPS_CAMPAIGN_CHANNEL, v)
									}
								/>
							</div>
							<div className="min-w-36 flex-1">
								<MarketingCabinetSelect
									size="compact"
									value={dashboardCampaignFilters.priority}
									aria-label={t(
										'overview.dashboard.listFilter.campaignPriorityAria'
									)}
									options={[
										{
											value: '',
											label: t('overview.dashboard.listFilter.all'),
										},
										...campaignPriorityOptions,
									]}
									onChange={(v) =>
										setCampaignUrlFilter(MC_OPS_CAMPAIGN_PRIORITY, v)
									}
								/>
							</div>
						</div>
						{filteredCampaigns.length === 0 ? (
							<DesktopAppEmptyState
								title={t('campaignsView.filteredEmptyTitle')}
								description={t('campaignsView.filteredEmptyDescription')}
							/>
						) : (
							<>
								<p className={cn('mc-meta-caption', DESKTOP_TYPOGRAPHY.meta)}>
									{campaignsTruncated
										? t('campaignsView.listSummaryTruncated', {
												shown: campaigns.length,
												total: campaignsTotal,
											})
										: t('campaignsView.listSummaryAll', {
												count: filteredCampaigns.length,
											})}
								</p>
								{filteredCampaigns.length >
								MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD ? (
									<VirtualVariableList
										items={filteredCampaigns}
										estimateSize={() => 200}
										getItemKey={(index) =>
											filteredCampaigns[index]?.id ?? `campaign-${index}`
										}
										height={480}
										overscanCount={6}
										className="rounded-(--desktop-radius)"
										renderItem={(campaign) => (
											<div className="pb-3">{renderCampaignCard(campaign)}</div>
										)}
									/>
								) : (
									<div className="space-y-3">
										{filteredCampaigns.map((campaign) => (
											<div key={campaign.id}>
												{renderCampaignCard(campaign)}
											</div>
										))}
									</div>
								)}
							</>
						)}
					</div>
				) : (
					<DesktopAppEmptyState
						className="min-h-[min(280px,50vh)] rounded-(--desktop-radius) border border-dashed border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/30"
						icon={
							<MegaphoneIcon
								className="h-8 w-8 text-(--mc-accent)"
								strokeWidth={DESKTOP_LUCIDE.stroke}
								aria-hidden
							/>
						}
						title={t('campaignsView.emptyListTitle')}
						description={t('campaignsView.emptyListDescription')}
					/>
				)}
			</SectionPanel>

			<SectionPanel
				title={
					editingCampaign
						? t('campaignsView.formEditTitle')
						: t('campaignsView.formNewTitle')
				}
				description={t('campaignsView.formDescription')}
			>
				<form
					className="space-y-4"
					onSubmit={handleSubmit}
					aria-busy={isPending}
				>
					<div className={INPUT_STACK_CLASS}>
						<div className="space-y-2">
							<InputLabel htmlFor={fid.name} required>
								{t('campaignsView.fieldName')}
							</InputLabel>
							<DesktopAppInput
								id={fid.name}
								value={form.name}
								onChange={(event) =>
									setForm((prev) => ({ ...prev, name: event.target.value }))
								}
								placeholder={t('campaignsView.phName')}
							/>
						</div>
						<div className="space-y-2">
							<InputLabel htmlFor={fid.channel}>
								{t('campaignsView.fieldChannel')}
							</InputLabel>
							<MarketingCabinetSelect
								id={fid.channel}
								value={form.channel}
								onChange={(channel) =>
									setForm((prev) => ({ ...prev, channel }))
								}
								options={channelOptions}
							/>
						</div>
					</div>
					<div className={INPUT_STACK_CLASS}>
						<div className="space-y-2">
							<InputLabel htmlFor={fid.status}>
								{t('campaignsView.fieldStatus')}
							</InputLabel>
							<MarketingCabinetSelect
								id={fid.status}
								value={form.status}
								onChange={(status) => setForm((prev) => ({ ...prev, status }))}
								options={campaignStatusOptions}
							/>
						</div>
						<div className="space-y-2">
							<InputLabel htmlFor={fid.priority}>
								{t('campaignsView.fieldPriority')}
							</InputLabel>
							<MarketingCabinetSelect
								id={fid.priority}
								value={form.priority}
								onChange={(priority) =>
									setForm((prev) => ({ ...prev, priority }))
								}
								options={campaignPriorityOptions}
							/>
						</div>
					</div>
					<div className="space-y-2">
						<InputLabel htmlFor={fid.objective}>
							{t('campaignsView.fieldObjective')}
						</InputLabel>
						<textarea
							id={fid.objective}
							className={TEXTAREA_CLASS}
							value={form.objective}
							onChange={(event) =>
								setForm((prev) => ({ ...prev, objective: event.target.value }))
							}
							placeholder={t('campaignsView.phObjective')}
						/>
					</div>
					<div className="space-y-2">
						<InputLabel htmlFor={fid.hypothesis}>
							{t('campaignsView.fieldHypothesis')}
						</InputLabel>
						<textarea
							id={fid.hypothesis}
							className={TEXTAREA_CLASS}
							value={form.hypothesis}
							onChange={(event) =>
								setForm((prev) => ({ ...prev, hypothesis: event.target.value }))
							}
							placeholder={t('campaignsView.phHypothesis')}
						/>
					</div>
					<div className={INPUT_STACK_CLASS}>
						<div className="space-y-2">
							<InputLabel htmlFor={fid.owner}>
								{t('campaignsView.fieldOwner')}
							</InputLabel>
							<DesktopAppInput
								id={fid.owner}
								value={form.owner_name}
								onChange={(event) =>
									setForm((prev) => ({
										...prev,
										owner_name: event.target.value,
									}))
								}
								placeholder={t('campaignsView.phOwner')}
							/>
						</div>
						<div className="space-y-2">
							<InputLabel htmlFor={fid.budget}>
								{t('campaignsView.fieldBudget')}
							</InputLabel>
							<DesktopAppInput
								id={fid.budget}
								value={form.budget}
								onChange={(event) =>
									setForm((prev) => ({ ...prev, budget: event.target.value }))
								}
								placeholder={t('campaignsView.phBudget')}
							/>
						</div>
					</div>
					<div className={INPUT_STACK_CLASS}>
						<div className="space-y-2">
							<InputLabel htmlFor={fid.kpiName}>
								{t('campaignsView.fieldKpiName')}
							</InputLabel>
							<DesktopAppInput
								id={fid.kpiName}
								value={form.target_metric_name}
								onChange={(event) =>
									setForm((prev) => ({
										...prev,
										target_metric_name: event.target.value,
									}))
								}
								placeholder={t('campaignsView.phKpiName')}
							/>
						</div>
						<div className="space-y-2">
							<InputLabel htmlFor={fid.kpiTarget}>
								{t('campaignsView.fieldKpiTarget')}
							</InputLabel>
							<DesktopAppInput
								id={fid.kpiTarget}
								value={form.target_metric}
								onChange={(event) =>
									setForm((prev) => ({
										...prev,
										target_metric: event.target.value,
									}))
								}
								placeholder={t('campaignsView.phKpiTarget')}
							/>
						</div>
					</div>
					<div className="space-y-2">
						<InputLabel htmlFor={fid.kpiActual}>
							{t('campaignsView.fieldKpiActual')}
						</InputLabel>
						<DesktopAppInput
							id={fid.kpiActual}
							value={form.actual_metric}
							onChange={(event) =>
								setForm((prev) => ({
									...prev,
									actual_metric: event.target.value,
								}))
							}
							placeholder={t('campaignsView.phKpiActual')}
						/>
					</div>
					<div className="space-y-2">
						<InputLabel id={fid.segGroup}>
							{t('campaignsView.fieldSegments')}
						</InputLabel>
						{segmentsQuery.isLoading ? (
							<div className={cn(DESKTOP_TYPOGRAPHY.meta)}>
								{t('campaignsView.loadingSegments')}
							</div>
						) : (availableSegments as MarketingSegment[]).length > 0 ? (
							<fieldset
								aria-labelledby={fid.segGroup}
								className="m-0 min-w-0 rounded-(--desktop-radius) border border-(--desktop-border-subtle) p-3"
							>
								<MarketingCabinetCheckboxPickList
									items={availableSegments as MarketingSegment[]}
									getLabel={(segment) => segment.name}
									selectedIds={selectedSegments}
									checkboxClassName={checkboxControl}
									labelClassName="flex items-start gap-2 text-sm text-(--desktop-text-secondary)"
									onToggle={(id, checked) => {
										setSelectedSegmentIds((current) =>
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
									'rounded-(--desktop-radius) border border-dashed border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/25 px-4 py-5 text-center leading-relaxed'
								)}
							>
								{t('campaignsView.addSegmentsFirst')}
							</div>
						)}
					</div>
					<div className="space-y-2">
						<InputLabel id={fid.vpGroup}>
							{t('campaignsView.fieldValueProps')}
						</InputLabel>
						{valuePropsQuery.isLoading ? (
							<div className={cn(DESKTOP_TYPOGRAPHY.meta)}>
								{t('campaignsView.loadingVp')}
							</div>
						) : (availableValueProps as MarketingValueProposition[]).length >
							0 ? (
							<fieldset
								aria-labelledby={fid.vpGroup}
								className="m-0 min-w-0 grid gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) p-3"
							>
								{(availableValueProps as MarketingValueProposition[]).map(
									(valueProp) => (
										<label
											key={valueProp.id}
											className="flex items-start gap-2 text-sm text-(--desktop-text-secondary)"
										>
											<input
												type="checkbox"
												className={checkboxControl}
												checked={selectedValueProps.has(valueProp.id)}
												onChange={(event) =>
													setSelectedValuePropIds((current) =>
														event.target.checked
															? [...current, valueProp.id]
															: current.filter((id) => id !== valueProp.id)
													)
												}
											/>
											<span>
												{valueProp.headline ||
													valueProp.value_statement ||
													valueProp.id}
											</span>
										</label>
									)
								)}
							</fieldset>
						) : (
							<div
								className={cn(
									DESKTOP_TYPOGRAPHY.meta,
									'rounded-(--desktop-radius) border border-dashed border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/25 px-4 py-5 text-center leading-relaxed'
								)}
							>
								{t('campaignsView.addVpFirst')}
							</div>
						)}
					</div>
					{createMutation.isError || updateMutation.isError ? (
						<DesktopAppErrorState
							message={extractApiErrorMessage(
								createMutation.error || updateMutation.error,
								t('campaignsView.saveErrorDefault')
							)}
						/>
					) : null}
					<div className="flex items-center justify-end gap-2">
						{editingCampaign ? (
							<DesktopAppButton
								type="button"
								variant="ghost"
								onClick={resetForm}
							>
								{t('common.cancel')}
							</DesktopAppButton>
						) : null}
						<DesktopAppButton
							type="submit"
							variant="accent"
							disabled={isPending || !form.name.trim()}
						>
							{isPending ? (
								<ArrowPathIcon
									className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
							) : null}
							{editingCampaign
								? t('campaignsView.submitSave')
								: t('campaignsView.submitCreate')}
						</DesktopAppButton>
					</div>
				</form>
			</SectionPanel>
		</div>
	);
}
