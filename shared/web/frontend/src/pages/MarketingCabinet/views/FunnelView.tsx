import * as React from 'react';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	ChevronDownIcon,
	FunnelIcon,
	ArrowPathIcon,
	PlusIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import { VirtualVariableList } from '@/components/shared/VirtualList';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
	DesktopAppErrorState,
	DesktopAppInput,
	DesktopAppSurface,
	DESKTOP_APP_STYLE_CONTRACT,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
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
} from '../constants';
import {
	marketingCabinetApi,
	type MarketingFunnel,
	MarketingFunnelStage,
} from '../marketingCabinetApi';
import { localizeStatus } from '../locales';
import { extractApiErrorMessage, requireDefined } from '../utils';
import { funnelStageRowsToWritePayload } from '../utils/funnelStageWritePayload';
import {
	marketingCabinetFunnelsQueryOptions,
	marketingCabinetProjectDashboardInvalidationQueryKey,
	marketingCabinetProjectSectionInvalidationQueryKey,
} from '../marketingCabinetQueryOptions';

interface FunnelStageRow {
	id: string;
	name: string;
	visitors: string;
	conversions: string;
}

interface FunnelFormState {
	name: string;
	status: string;
	primary_goal: string;
	stageRows: FunnelStageRow[];
}

const initialFormBase: Omit<FunnelFormState, 'stageRows'> = {
	name: '',
	status: 'draft',
	primary_goal: '',
};

function newStageRowId(): string {
	return typeof crypto !== 'undefined' && crypto.randomUUID
		? crypto.randomUUID()
		: `st-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function stagesSeedToRows(seed: string): FunnelStageRow[] {
	return parseStages(seed).map((s) => ({
		id: newStageRowId(),
		name: s.stage_name,
		visitors: String(s.visitors),
		conversions: String(s.conversions),
	}));
}

function funnelApiStagesToRows(
	stages: MarketingFunnel['stages']
): FunnelStageRow[] {
	return sortedFunnelStages(stages).map((s) => ({
		id: newStageRowId(),
		name: s.stage_name,
		visitors: String(s.visitors),
		conversions: String(s.conversions),
	}));
}

function stageRowsToPayload(rows: FunnelStageRow[]) {
	return funnelStageRowsToWritePayload(rows);
}

function parseStages(value: string) {
	return value
		.split('\n')
		.map((line, index) => {
			const [stage_name = '', visitors = '0', conversions = '0'] = line
				.split('|')
				.map((item) => item.trim());
			return {
				stage_name,
				stage_order: index,
				visitors: Number(visitors || 0),
				conversions: Number(conversions || 0),
			};
		})
		.filter((item) => item.stage_name);
}

function sortedFunnelStages(stages: MarketingFunnel['stages']) {
	return [...(stages ?? [])].sort((a, b) => a.stage_order - b.stage_order);
}

function effectiveConversionRate(stage: MarketingFunnelStage) {
	if (stage.conversion_rate != null) return stage.conversion_rate;
	if (stage.visitors > 0) return stage.conversions / stage.visitors;
	return null;
}

function funnelBarWidthPct(
	stage: MarketingFunnelStage,
	refVisitors: number,
	hasPositiveVisitors: boolean
) {
	if (!hasPositiveVisitors) return 100;
	if (refVisitors <= 0) return 100;
	if (stage.visitors <= 0) return 16;
	return Math.max(22, Math.min(100, (stage.visitors / refVisitors) * 100));
}

function FunnelStageFlow({
	stages,
	headingId,
}: {
	stages: MarketingFunnel['stages'];
	headingId: string;
}) {
	const { t } = useTranslation('marketing');
	const ordered = sortedFunnelStages(stages);
	const refVisitors = Math.max(ordered[0]?.visitors ?? 0, 1);
	const hasPositiveVisitors = ordered.some((s) => s.visitors > 0);

	if (ordered.length === 0) {
		return (
			<div
				className="rounded-(--desktop-radius) border border-dashed border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/60 px-4 py-8 text-center"
				role="status"
				aria-labelledby={headingId}
			>
				<FunnelIcon
					className="mx-auto mb-3 h-8 w-8 text-(--desktop-text-dim)"
					strokeWidth={1.25}
					aria-hidden
				/>
				<p
					id={headingId}
					className="text-xs font-medium text-(--desktop-text-secondary)"
				>
					{t('funnelView.fieldStages')}
				</p>
				<p
					className={cn(
						DESKTOP_TYPOGRAPHY.meta,
						'mt-1 max-w-sm mx-auto leading-relaxed'
					)}
				>
					{t('funnelView.formDescription')}
				</p>
			</div>
		);
	}

	const flowLabel = t('funnelView.fieldStages');

	return (
		<div className="space-y-1.5">
			<p
				id={headingId}
				className={cn(DESKTOP_APP_STYLE_CONTRACT.sectionLabel, 'font-medium')}
			>
				{flowLabel}
			</p>
			<ol
				className="m-0 flex w-full list-none flex-col items-center gap-0 p-0 pt-0.5"
				aria-label={flowLabel}
			>
				{ordered.map((stage, index) => {
					const widthPct = funnelBarWidthPct(
						stage,
						refVisitors,
						hasPositiveVisitors
					);
					const rate = effectiveConversionRate(stage);
					return (
						<li key={stage.id} className="w-full">
							<div className="flex w-full justify-center px-1">
								<div
									className="min-w-0 rounded-(--desktop-radius) border border-(--mc-accent-35) bg-(--desktop-surface-accent) shadow-sm transition-[width] duration-200 ease-out"
									style={{ width: `${widthPct}%` }}
								>
									<div className="px-3 py-2.5 sm:px-3.5 sm:py-3">
										<div className="text-xs font-semibold leading-tight text-(--desktop-text-primary) sm:text-sm">
											{stage.stage_name}
										</div>
										<dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:text-xs">
											<div>
												<dt className="text-(--desktop-text-muted)">
													{t('funnelView.visitors')}
												</dt>
												<dd className="font-medium tabular-nums text-(--desktop-text-secondary)">
													{stage.visitors}
												</dd>
											</div>
											<div>
												<dt className="text-(--desktop-text-muted)">
													{t('funnelView.conversions')}
												</dt>
												<dd className="font-medium tabular-nums text-(--desktop-text-secondary)">
													{stage.conversions}
												</dd>
											</div>
										</dl>
										<div className="mt-2 border-t border-(--desktop-border-subtle) pt-2 text-xs font-semibold tabular-nums text-(--mc-accent) sm:text-sm">
											{rate != null
												? `${(rate * 100).toFixed(1)}%`
												: t('common.na')}
										</div>
									</div>
								</div>
							</div>
							{index < ordered.length - 1 ? (
								<div
									className="flex justify-center py-1 text-(--desktop-text-dim)"
									aria-hidden
								>
									<ChevronDownIcon
										className="h-4 w-4 shrink-0"
										strokeWidth={2}
									/>
								</div>
							) : null}
						</li>
					);
				})}
			</ol>
		</div>
	);
}

export function FunnelView({
	selectedProjectId,
	focusedEntityId = null,
	allowMarketingWrite = true,
}: {
	selectedProjectId: string | null;
	focusedEntityId?: string | null;
	allowMarketingWrite?: boolean;
}) {
	const { t } = useTranslation('marketing');
	const funnelStatusOptions = [
		{ value: 'draft', label: t('funnelView.status.draft') },
		{ value: 'active', label: t('funnelView.status.active') },
		{ value: 'completed', label: t('funnelView.status.completed') },
	];
	const uid = useId();
	const fid = {
		name: `${uid}-name`,
		status: `${uid}-status`,
		goal: `${uid}-goal`,
	};
	const queryClient = useQueryClient();
	const [form, setForm] = useState<FunnelFormState>(() => ({
		...initialFormBase,
		stageRows: stagesSeedToRows(t('funnelView.stagesSeed')),
	}));
	const [editingFunnel, setEditingFunnel] = useState<MarketingFunnel | null>(
		null
	);

	const funnelsQuery = useQuery({
		...marketingCabinetFunnelsQueryOptions(selectedProjectId),
		enabled: Boolean(selectedProjectId),
	});

	const createMutation = useMutation({
		mutationFn: () =>
			marketingCabinetApi.createFunnel({
				project_id: requireDefined(selectedProjectId, 'selectedProjectId'),
				name: form.name.trim(),
				status: form.status,
				primary_goal: form.primary_goal.trim() || null,
				stages: stageRowsToPayload(form.stageRows),
			}),
		onSuccess: () => {
			resetForm();
			void queryClient.invalidateQueries({
				queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
					'funnels',
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
			if (!editingFunnel) throw new Error('Funnel not selected');
			return marketingCabinetApi.updateFunnel(editingFunnel.id, {
				name: form.name.trim(),
				status: form.status,
				primary_goal: form.primary_goal.trim() || null,
				stages: stageRowsToPayload(form.stageRows),
			});
		},
		onSuccess: () => {
			resetForm();
			void queryClient.invalidateQueries({
				queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
					'funnels',
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
		mutationFn: (funnelId: string) =>
			marketingCabinetApi.deleteFunnel(funnelId),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: marketingCabinetProjectSectionInvalidationQueryKey(
					'funnels',
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

	const funnels = funnelsQuery.data?.items ?? [];
	const funnelsTotal = funnelsQuery.data?.total ?? funnels.length;
	const funnelsTruncated = funnelsTotal > funnels.length;
	const isPending = createMutation.isPending || updateMutation.isPending;

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
		setForm({
			...initialFormBase,
			stageRows: stagesSeedToRows(t('funnelView.stagesSeed')),
		});
		setEditingFunnel(null);
	}

	function hydrateForm(funnel: MarketingFunnel) {
		setEditingFunnel(funnel);
		setForm({
			name: funnel.name,
			status: funnel.status || 'draft',
			primary_goal: funnel.primary_goal || '',
			stageRows:
				(funnel.stages ?? []).length > 0
					? funnelApiStagesToRows(funnel.stages ?? [])
					: stagesSeedToRows(t('funnelView.stagesSeed')),
		});
	}

	function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!selectedProjectId || !form.name.trim()) return;
		if (editingFunnel) {
			void updateMutation.mutateAsync();
			return;
		}
		void createMutation.mutateAsync();
	}

	function renderFunnelCard(funnel: MarketingFunnel) {
		return (
			<DesktopAppSurface
				variant="soft"
				data-marketing-entity-id={funnel.id}
				className={cn(
					'space-y-4 p-4 sm:p-5',
					focusedEntityId === funnel.id && 'ring-1 ring-(--mc-accent-60)'
				)}
			>
				<div className="flex items-start justify-between gap-3 sm:gap-4">
					<div className="min-w-0 space-y-1">
						<div className="text-sm font-semibold leading-snug text-(--desktop-text-primary) sm:text-base">
							{funnel.name}
						</div>
						<div className={DESKTOP_TYPOGRAPHY.meta}>
							{localizeStatus(funnel.status)}
						</div>
					</div>
					<div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => hydrateForm(funnel)}
						>
							{t('common.edit')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="icon"
							onClick={() => deleteMutation.mutate(funnel.id)}
							aria-label={t('funnelView.deleteAria', {
								name: funnel.name,
							})}
						>
							<TrashIcon
								className="h-4 w-4"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						</DesktopAppButton>
					</div>
				</div>
				{funnel.primary_goal ? (
					<p className="text-sm leading-relaxed text-(--desktop-text-secondary)">
						{funnel.primary_goal}
					</p>
				) : null}
				<FunnelStageFlow
					stages={funnel.stages ?? []}
					headingId={`${uid}-funnel-flow-${funnel.id}`}
				/>
			</DesktopAppSurface>
		);
	}

	if (!selectedProjectId) {
		return (
			<EmptyProjectState
				title={t('common.pickProjectTitle')}
				description={t('funnelView.emptyProjectDescription')}
			/>
		);
	}

	return (
		<div className="grid gap-5 xl:grid-cols-[1.12fr_0.88fr] xl:gap-6">
			<SectionPanel
				title={t('funnelView.panelListTitle')}
				description={t('funnelView.panelListDescription')}
				actions={
					<div className="flex flex-wrap items-center gap-2">
						{allowMarketingWrite ? (
							<MarketingSectionGenerateAiButton
								projectId={selectedProjectId}
								targetSection="funnels"
								allowMarketingWrite={allowMarketingWrite}
								invalidateQueryKeys={[
									marketingCabinetProjectSectionInvalidationQueryKey(
										'funnels',
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
							targetSection="funnels"
							targetLabel={t('funnelView.docAutofillLabel')}
							invalidateQueryKeys={[
								marketingCabinetProjectSectionInvalidationQueryKey(
									'funnels',
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
				{funnelsQuery.isLoading ? (
					<LoadingGrid />
				) : funnelsQuery.isError ? (
					<DesktopAppErrorState
						message={extractApiErrorMessage(
							funnelsQuery.error,
							t('funnelView.loadErrorDefault')
						)}
						onAction={() => void funnelsQuery.refetch()}
					/>
				) : funnels.length > 0 ? (
					<div className="space-y-4">
						<p className={cn('mc-meta-caption', DESKTOP_TYPOGRAPHY.meta)}>
							{funnelsTruncated
								? t('cabinetPage.listFetchSummaryTruncated', {
										shown: funnels.length,
										total: funnelsTotal,
									})
								: t('cabinetPage.listFetchSummaryAll', {
										count: funnels.length,
									})}
						</p>
						{funnels.length > MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD ? (
							<VirtualVariableList
								items={funnels}
								estimateSize={() => 280}
								getItemKey={(index) => funnels[index]?.id ?? `funnel-${index}`}
								height={520}
								overscanCount={4}
								className="rounded-(--desktop-radius)"
								renderItem={(funnel) => (
									<div className="pb-4">{renderFunnelCard(funnel)}</div>
								)}
							/>
						) : (
							<div className="space-y-4">
								{funnels.map((funnel) => (
									<div key={funnel.id}>{renderFunnelCard(funnel)}</div>
								))}
							</div>
						)}
					</div>
				) : (
					<DesktopAppEmptyState
						icon={
							<FunnelIcon
								className="h-7 w-7 text-(--desktop-text-dim)"
								strokeWidth={1.5}
								aria-hidden
							/>
						}
						title={t('funnelView.emptyListTitle')}
						description={t('funnelView.emptyListDescription')}
					/>
				)}
			</SectionPanel>
			<SectionPanel
				title={
					editingFunnel
						? t('funnelView.formEditTitle')
						: t('funnelView.formNewTitle')
				}
				description={t('funnelView.formDescription')}
			>
				<form
					className="space-y-5"
					onSubmit={handleSubmit}
					aria-busy={isPending}
				>
					<div className={INPUT_STACK_CLASS}>
						<div className="space-y-2">
							<InputLabel htmlFor={fid.name} required>
								{t('funnelView.fieldName')}
							</InputLabel>
							<DesktopAppInput
								id={fid.name}
								value={form.name}
								onChange={(event) =>
									setForm((prev) => ({ ...prev, name: event.target.value }))
								}
								placeholder={t('funnelView.phName')}
							/>
						</div>
						<div className="space-y-2">
							<InputLabel htmlFor={fid.status}>
								{t('funnelView.fieldStatus')}
							</InputLabel>
							<MarketingCabinetSelect
								id={fid.status}
								value={form.status}
								onChange={(status) => setForm((prev) => ({ ...prev, status }))}
								options={funnelStatusOptions}
							/>
						</div>
					</div>
					<div className="space-y-2">
						<InputLabel htmlFor={fid.goal}>
							{t('funnelView.fieldGoal')}
						</InputLabel>
						<DesktopAppInput
							id={fid.goal}
							value={form.primary_goal}
							onChange={(event) =>
								setForm((prev) => ({
									...prev,
									primary_goal: event.target.value,
								}))
							}
							placeholder={t('funnelView.phGoal')}
						/>
					</div>
					<div className="space-y-3">
						<div className="flex flex-wrap items-end justify-between gap-2">
							<InputLabel className="mb-0">
								{t('funnelView.fieldStages')}
							</InputLabel>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="sm"
								className="shrink-0 gap-1"
								onClick={() =>
									setForm((prev) => ({
										...prev,
										stageRows: [
											...prev.stageRows,
											{
												id: newStageRowId(),
												name: '',
												visitors: '0',
												conversions: '0',
											},
										],
									}))
								}
							>
								<PlusIcon
									className="h-3.5 w-3.5"
									strokeWidth={DESKTOP_LUCIDE.stroke}
									aria-hidden
								/>
								{t('funnelView.addStage')}
							</DesktopAppButton>
						</div>
						<div className="space-y-2">
							{form.stageRows.map((row, index) => (
								<div
									key={row.id}
									className="grid gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle)/80 bg-(--desktop-surface-soft)/50 p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,6rem)_minmax(0,6rem)_auto]"
								>
									<div className="space-y-1">
										<span
											className={cn(DESKTOP_TYPOGRAPHY.caption, 'font-medium')}
										>
											{t('funnelView.stageName')}
										</span>
										<DesktopAppInput
											value={row.name}
											onChange={(e) => {
												const v = e.target.value;
												setForm((prev) => ({
													...prev,
													stageRows: prev.stageRows.map((r) =>
														r.id === row.id ? { ...r, name: v } : r
													),
												}));
											}}
											placeholder={t('funnelView.phStageName')}
										/>
									</div>
									<div className="space-y-1">
										<span
											className={cn(DESKTOP_TYPOGRAPHY.caption, 'font-medium')}
										>
											{t('funnelView.visitors')}
										</span>
										<DesktopAppInput
											inputMode="numeric"
											value={row.visitors}
											onChange={(e) => {
												const v = e.target.value;
												setForm((prev) => ({
													...prev,
													stageRows: prev.stageRows.map((r) =>
														r.id === row.id ? { ...r, visitors: v } : r
													),
												}));
											}}
										/>
									</div>
									<div className="space-y-1">
										<span
											className={cn(DESKTOP_TYPOGRAPHY.caption, 'font-medium')}
										>
											{t('funnelView.conversions')}
										</span>
										<DesktopAppInput
											inputMode="numeric"
											value={row.conversions}
											onChange={(e) => {
												const v = e.target.value;
												setForm((prev) => ({
													...prev,
													stageRows: prev.stageRows.map((r) =>
														r.id === row.id ? { ...r, conversions: v } : r
													),
												}));
											}}
										/>
									</div>
									<div className="flex items-end justify-end sm:pb-0.5">
										<DesktopAppButton
											type="button"
											variant="ghost"
											size="icon"
											className="h-9 w-9 shrink-0"
											disabled={form.stageRows.length <= 1}
											onClick={() =>
												setForm((prev) => ({
													...prev,
													stageRows: prev.stageRows.filter(
														(r) => r.id !== row.id
													),
												}))
											}
											aria-label={t('funnelView.removeStageAria', {
												index: index + 1,
											})}
										>
											<TrashIcon
												className="h-4 w-4"
												strokeWidth={DESKTOP_LUCIDE.stroke}
												aria-hidden
											/>
										</DesktopAppButton>
									</div>
								</div>
							))}
						</div>
					</div>
					{createMutation.isError || updateMutation.isError ? (
						<DesktopAppErrorState
							message={extractApiErrorMessage(
								createMutation.error || updateMutation.error,
								t('funnelView.saveErrorDefault')
							)}
						/>
					) : null}
					<div className="flex items-center justify-end gap-2">
						{editingFunnel ? (
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
							{editingFunnel
								? t('funnelView.submitSave')
								: t('funnelView.submitCreate')}
						</DesktopAppButton>
					</div>
				</form>
			</SectionPanel>
		</div>
	);
}
