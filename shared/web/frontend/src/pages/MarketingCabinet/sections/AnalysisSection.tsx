import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	ArrowTopRightOnSquareIcon,
	ClipboardIcon,
	ClipboardDocumentIcon,
	PaintBrushIcon,
	PencilSquareIcon,
	ShieldCheckIcon,
	SparklesIcon,
	TrashIcon,
	UserGroupIcon,
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
	DesktopAppSectionLabel,
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
	formatDateTime,
	localizeCompetitorType,
	localizeStatus,
} from '../locales';
import type {
	CompetitorFormState,
	SwotManualFormState,
} from '../marketingCabinetPageTypes';
import type {
	MarketingAiRunDetailResponse,
	MarketingCompany,
	MarketingCompetitor,
	MarketingListResponse,
	MarketingSwot,
} from '../marketingCabinetApi';
import { cabinetNotify } from '../cabinetNotify';
import { copyToClipboard, extractApiErrorMessage, isValidUrl } from '../utils';
import type {
	MutationLike,
	QueryLike,
} from '../marketingCabinetPage/marketingCabinetComposeHosts';
import type { MarketingDeleteModalSetter } from './CompaniesSection';
import {
	marketingCabinetProjectDashboardInvalidationQueryKey,
	marketingCabinetProjectSectionInvalidationQueryKey,
} from '../marketingCabinetQueryOptions';

import {
	MC_OPS_COMPETITOR_TYPE,
	parseMarketingCabinetOpsListFilters,
} from '../operationsDeepLink';

export interface AnalysisSectionProps {
	selectedProjectId: string | null;
	selectedCompanyId: string | null;
	selectedCompany: MarketingCompany | null;
	focusedEntityId: string | null;
	allowMarketingWrite: boolean;
	swotItems: MarketingSwot[];
	swotQuery: QueryLike<MarketingListResponse<MarketingSwot>>;
	handleCopyAllSwot: () => void | Promise<void>;
	handleExportSwot: () => void;
	handleCopySingleSwot: (swot: MarketingSwot) => void | Promise<void>;
	generateSwotMutation: MutationLike;
	swotGenerateRunId: string | null;
	swotGenerateRunQuery: QueryLike<MarketingAiRunDetailResponse>;
	swotGenerateContext: string;
	setSwotGenerateContext: React.Dispatch<React.SetStateAction<string>>;
	setEditingSwot: React.Dispatch<React.SetStateAction<MarketingSwot | null>>;
	setDeleteModal: MarketingDeleteModalSetter;
	swotManualForm: SwotManualFormState;
	setSwotManualForm: React.Dispatch<React.SetStateAction<SwotManualFormState>>;
	handleCreateSwot: (event: React.FormEvent) => void;
	createSwotMutation: MutationLike;
	competitors: MarketingCompetitor[];
	filteredCompetitors: MarketingCompetitor[];
	competitorsQuery: QueryLike<MarketingListResponse<MarketingCompetitor>>;
	competitorSearch: string;
	setCompetitorSearch: React.Dispatch<React.SetStateAction<string>>;
	debouncedCompetitorSearch: string;
	handleCopyAllCompetitors: () => void | Promise<void>;
	handleExportCompetitors: () => void;
	handleCopySingleCompetitor: (c: MarketingCompetitor) => void | Promise<void>;
	setEditingCompetitor: React.Dispatch<
		React.SetStateAction<MarketingCompetitor | null>
	>;
	competitorForm: CompetitorFormState;
	setCompetitorForm: React.Dispatch<React.SetStateAction<CompetitorFormState>>;
	competitorTypeSelectOptions: Array<{ value: string; label: string }>;
	handleCreateCompetitor: (event: React.FormEvent) => void;
	createCompetitorMutation: MutationLike;
	competitorOpsUrlEpoch: number;
	onCompetitorOpsUrlChange?: () => void;
}

export function AnalysisSection(props: AnalysisSectionProps) {
	const { t } = useTranslation('marketing');
	const {
		selectedProjectId,
		selectedCompanyId,
		selectedCompany,
		focusedEntityId,
		allowMarketingWrite,
		swotItems,
		swotQuery,
		handleCopyAllSwot,
		handleExportSwot,
		handleCopySingleSwot,
		generateSwotMutation,
		swotGenerateRunId,
		swotGenerateRunQuery,
		swotGenerateContext,
		setSwotGenerateContext,
		setEditingSwot,
		setDeleteModal,
		swotManualForm,
		setSwotManualForm,
		handleCreateSwot,
		createSwotMutation,
		competitors,
		filteredCompetitors,
		competitorsQuery,
		competitorSearch,
		setCompetitorSearch,
		debouncedCompetitorSearch,
		handleCopyAllCompetitors,
		handleExportCompetitors,
		handleCopySingleCompetitor,
		setEditingCompetitor,
		competitorForm,
		setCompetitorForm,
		competitorTypeSelectOptions,
		handleCreateCompetitor,
		createCompetitorMutation,
		competitorOpsUrlEpoch,
		onCompetitorOpsUrlChange,
	} = props;

	const swotDbTotal = swotQuery.data?.total ?? swotItems.length;
	const swotFetchTruncated = swotDbTotal > swotItems.length;
	const competitorsDbTotal = competitorsQuery.data?.total ?? competitors.length;
	const competitorsFetchTruncated = competitorsDbTotal > competitors.length;

	const dashboardCompetitorFilters = useMemo(() => {
		void competitorOpsUrlEpoch;
		if (typeof window === 'undefined') {
			return { competitor_type: '' };
		}
		return parseMarketingCabinetOpsListFilters(window.location.search)
			.competitor;
	}, [competitorOpsUrlEpoch]);

	const setCompetitorUrlFilter = useCallback(
		(key: string, value: string) => {
			if (typeof window === 'undefined') return;
			const url = new URL(window.location.href);
			const v = value.trim();
			if (v) url.searchParams.set(key, v);
			else url.searchParams.delete(key);
			window.history.replaceState({}, '', url.toString());
			onCompetitorOpsUrlChange?.();
		},
		[onCompetitorOpsUrlChange]
	);

	const clearCompetitorListFilters = useCallback(() => {
		setCompetitorSearch('');
		if (typeof window === 'undefined') return;
		const url = new URL(window.location.href);
		url.searchParams.delete(MC_OPS_COMPETITOR_TYPE);
		window.history.replaceState({}, '', url.toString());
		onCompetitorOpsUrlChange?.();
	}, [onCompetitorOpsUrlChange, setCompetitorSearch]);

	if (!selectedProjectId) {
		return (
			<EmptyProjectState
				title={t('cabinetPage.analysis.emptyTitle')}
				description={t('cabinetPage.analysis.emptyDescription')}
			/>
		);
	}

	const renderSwotAnalysisCard = (
		swot: MarketingSwot,
		opts?: { virtualized?: boolean }
	) => {
		const countPills = [
			{
				k: 's',
				short: 'S',
				n: swot.strengths_count ?? swot.factors?.strength?.length ?? 0,
				className:
					'bg-(--mc-accent-12) text-(--desktop-text-primary) ring-1 ring-(--mc-accent-22)',
			},
			{
				k: 'w',
				short: 'W',
				n: swot.weaknesses_count ?? swot.factors?.weakness?.length ?? 0,
				className: 'bg-amber-950/40 text-amber-100/90 ring-1 ring-amber-600/25',
			},
			{
				k: 'o',
				short: 'O',
				n: swot.opportunities_count ?? swot.factors?.opportunity?.length ?? 0,
				className: 'bg-sky-950/35 text-sky-100/88 ring-1 ring-sky-600/25',
			},
			{
				k: 't',
				short: 'T',
				n: swot.threats_count ?? swot.factors?.threat?.length ?? 0,
				className: 'bg-red-950/35 text-red-100/90 ring-1 ring-red-500/25',
			},
		];
		const quadrants = [
			[
				'Strengths',
				swot.factors?.strength ?? [],
				t('cabinetPage.swotFactor.strength'),
				'border-l-(--mc-accent-55) bg-(--mc-accent-06)',
			] as const,
			[
				'Weaknesses',
				swot.factors?.weakness ?? [],
				t('cabinetPage.swotFactor.weakness'),
				'border-l-amber-600/55 bg-amber-950/[0.18]',
			] as const,
			[
				'Opportunities',
				swot.factors?.opportunity ?? [],
				t('cabinetPage.swotFactor.opportunity'),
				'border-l-sky-500/50 bg-sky-950/[0.2]',
			] as const,
			[
				'Threats',
				swot.factors?.threat ?? [],
				t('cabinetPage.swotFactor.threat'),
				'border-l-red-500/55 bg-red-950/[0.18]',
			] as const,
		];
		return (
			<MarketingEntityCard
				helpBlockId="analysis.swot_list"
				className={cn(
					'space-y-3 p-4',
					focusedEntityId === swot.id && 'ring-1 ring-(--mc-accent-60)'
				)}
				data-marketing-entity-id={swot.id}
			>
				<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
					<div className="min-w-0 flex-1 space-y-2">
						<div className="flex flex-wrap items-center gap-2">
							<div className="min-w-0 flex-1 space-y-1">
								<div className="text-sm font-medium text-(--desktop-text-primary)">
									{swot.title}
								</div>
								<div className={cn(DESKTOP_TYPOGRAPHY.meta)}>
									{swot.company_name || selectedCompany?.name || 'company'} ·{' '}
									{formatDateTime(swot.updated_at)}
								</div>
							</div>
							<fieldset
								className="m-0 flex min-w-0 shrink-0 flex-wrap gap-1 border-0 p-0"
								aria-label={t('cabinetPage.analysis.factorPillsAria')}
							>
								{countPills.map((c) => (
									<span
										key={c.k}
										className={cn(
											'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
											c.className
										)}
										title={`${c.short}: ${c.n}`}
									>
										<span className="opacity-80">{c.short}</span>
										{c.n}
									</span>
								))}
							</fieldset>
						</div>
					</div>
					<div className="flex shrink-0 flex-wrap items-center gap-1 self-start sm:self-auto">
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="icon"
							aria-label={t('cabinetPage.copy.copySwotCardAria')}
							onClick={(e) => {
								if (opts?.virtualized) e.stopPropagation();
								void handleCopySingleSwot(swot);
							}}
						>
							<ClipboardDocumentIcon
								className="h-4 w-4"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="sm"
							aria-label={t('cabinetPage.analysis.editSwotAria')}
							title={t('cabinetPage.analysis.editSwotTitle')}
							onClick={(e) => {
								if (opts?.virtualized) e.stopPropagation();
								setEditingSwot(swot);
							}}
						>
							<PencilSquareIcon
								className="h-4 w-4 sm:mr-1"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
							<span className="hidden sm:inline">
								{t('cabinetPage.analysis.editSwotShort')}
							</span>
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							variant="ghost"
							size="icon"
							aria-label={t('cabinetPage.analysis.deleteSwotAria', {
								title: swot.title ?? '',
							})}
							title={t('cabinetPage.analysis.deleteSwotTitle')}
							onClick={(e) => {
								if (opts?.virtualized) e.stopPropagation();
								setDeleteModal({
									type: 'swot',
									id: swot.id,
									name: swot.title ?? '',
								});
							}}
						>
							<TrashIcon
								className="h-4 w-4"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						</DesktopAppButton>
					</div>
				</div>
				{swot.executive_summary ? (
					<p
						className="text-sm leading-6 text-(--desktop-text-secondary) line-clamp-3"
						title={swot.executive_summary}
					>
						{swot.executive_summary}
					</p>
				) : null}
				<div className="grid gap-3 md:grid-cols-2">
					{quadrants.map(([key, items, label, accent]) => (
						<div
							key={key}
							className={cn(
								'rounded-[calc(var(--desktop-radius)-2px)] border border-(--desktop-border-subtle) p-3',
								'border-l-[3px]',
								accent
							)}
						>
							<DesktopAppSectionLabel>{label}</DesktopAppSectionLabel>
							{items.length > 0 ? (
								<ul className="mt-2 space-y-2 text-xs leading-5 text-(--desktop-text-secondary)">
									{items.slice(0, 3).map((item) => (
										<li
											key={item.id ?? `${key}-${item.factor_text}`}
											className="pl-0.5"
										>
											{item.factor_text}
										</li>
									))}
								</ul>
							) : (
								<p className="mt-2 text-xs text-(--desktop-text-dim)">
									{t('cabinetPage.analysis.factorsEmpty')}
								</p>
							)}
							{items.length > 3 ? (
								<p className="mt-2 text-xs font-medium text-(--desktop-text-dim)">
									{t('cabinetPage.analysis.moreFactors', {
										count: items.length - 3,
									})}
								</p>
							) : null}
						</div>
					))}
				</div>
			</MarketingEntityCard>
		);
	};

	const renderCompetitorCard = (competitor: MarketingCompetitor) => (
		<MarketingEntityCard
			helpBlockId="analysis.competitors"
			className="space-y-3 p-4"
		>
			<div className="flex items-start justify-between gap-3">
				<div>
					<div
						className="text-sm font-medium text-(--desktop-text-primary)"
						title={competitor.name ?? undefined}
					>
						{competitor.name}
					</div>
					<div className={cn(DESKTOP_TYPOGRAPHY.meta)}>
						{localizeCompetitorType(competitor.competitor_type)} ·{' '}
						{competitor.market_position ||
							t('cabinetPage.analysis.positionNotSet')}
					</div>
				</div>
				<div className="flex items-center gap-1">
					{competitor.website ? (
						<>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="icon"
								onClick={() => {
									const w = competitor.website;
									if (!w) return;
									const url = w.startsWith('http') ? w : `https://${w}`;
									window.open(url, '_blank', 'noopener,noreferrer');
								}}
								aria-label={t('cabinetPage.setup.openWebsiteAria', {
									name: competitor.name ?? '',
								})}
							>
								<ArrowTopRightOnSquareIcon
									className="h-4 w-4"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							</DesktopAppButton>
							<DesktopAppButton
								type="button"
								variant="ghost"
								size="icon"
								onClick={async () => {
									const w = competitor.website;
									if (!w) return;
									const ok = await copyToClipboard(w);
									if (ok) cabinetNotify.success(t('toolbar.linkCopied'));
									else cabinetNotify.error(t('toolbar.idCopyFailed'));
								}}
								aria-label={t('cabinetPage.setup.copyWebsiteAria', {
									name: competitor.name ?? '',
								})}
							>
								<ClipboardDocumentIcon
									className="h-4 w-4"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							</DesktopAppButton>
						</>
					) : null}
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="icon"
						onClick={() => void handleCopySingleCompetitor(competitor)}
						aria-label={t('cabinetPage.copy.copyCompetitorCardAria')}
					>
						<ClipboardIcon
							className="h-4 w-4"
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="ghost"
						size="icon"
						onClick={(e) => {
							e.stopPropagation();
							setEditingCompetitor(competitor);
						}}
						aria-label={t('cabinetPage.analysis.editCompetitorAria', {
							name: competitor.name ?? '',
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
								type: 'competitor',
								id: competitor.id,
								name: competitor.name ?? '',
							})
						}
						aria-label={t('cabinetPage.analysis.deleteCompetitorAria', {
							name: competitor.name ?? '',
						})}
					>
						<TrashIcon
							className="h-4 w-4"
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
					</DesktopAppButton>
				</div>
			</div>
			{competitor.description ? (
				<p className="text-sm leading-6 text-(--desktop-text-secondary)">
					{competitor.description}
				</p>
			) : null}
			<div className="grid gap-3">
				<div>
					<DesktopAppSectionLabel>
						{t('cabinetPage.analysis.strengthsSection')}
					</DesktopAppSectionLabel>
					<TokenList
						items={competitor.strengths ?? []}
						emptyText={t('cabinetPage.analysis.tokenEmpty')}
					/>
				</div>
				<div>
					<DesktopAppSectionLabel>
						{t('cabinetPage.analysis.weaknessesSection')}
					</DesktopAppSectionLabel>
					<TokenList
						items={competitor.weaknesses ?? []}
						emptyText={t('cabinetPage.analysis.tokenEmpty')}
					/>
				</div>
			</div>
		</MarketingEntityCard>
	);

	return (
		<div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:gap-6">
			<div className="grid gap-6 xl:gap-6">
				<SectionPanel
					title={t('cabinetPage.analysis.swotListTitle')}
					description={t('cabinetPage.analysis.swotListDescription')}
					helpBlockId="analysis.swot_list"
					actions={
						<div className="flex items-center gap-2">
							{swotItems.length > 0 ? (
								<>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										onClick={handleCopyAllSwot}
										aria-label={t('cabinetPage.analysis.copySwotAria')}
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
										onClick={handleExportSwot}
										aria-label={t('cabinetPage.analysis.exportSwotCsvAria')}
									>
										<ArrowDownTrayIcon
											className="h-4 w-4"
											strokeWidth={DESKTOP_LUCIDE.stroke}
										/>
										{t('evidenceView.csvButton')}
									</DesktopAppButton>
								</>
							) : null}
							<DesktopAppButton
								type="button"
								variant="accent"
								size="sm"
								onClick={() => generateSwotMutation.mutate(undefined)}
								disabled={
									!allowMarketingWrite ||
									!selectedProjectId ||
									generateSwotMutation.isPending ||
									Boolean(swotGenerateRunId)
								}
								aria-label={t('cabinetPage.analysis.generateSwotAiAria')}
							>
								{generateSwotMutation.isPending || swotGenerateRunId ? (
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
								{swotGenerateRunId
									? t('cabinetPage.analysis.generating')
									: t('cabinetPage.analysis.generateWithAi')}
							</DesktopAppButton>
							{allowMarketingWrite ? (
								<DocumentAutofillAction
									projectId={selectedProjectId}
									companyId={selectedCompanyId}
									targetSection="swot"
									targetLabel={t('cabinetPage.analysis.swotDocAutofillLabel')}
									invalidateQueryKeys={[
										marketingCabinetProjectSectionInvalidationQueryKey(
											'swot',
											selectedProjectId
										),
										marketingCabinetProjectDashboardInvalidationQueryKey(
											selectedProjectId
										),
									]}
								/>
							) : null}
						</div>
					}
				>
					<FieldLabel
						label={t('cabinetPage.analysis.aiContextLabel')}
						hint={t('cabinetPage.analysis.aiContextHint')}
					>
						<textarea
							className={TEXTAREA_CLASS}
							value={swotGenerateContext}
							onChange={(event) => setSwotGenerateContext(event.target.value)}
							placeholder={t('cabinetPage.analysis.phAiContext')}
						/>
					</FieldLabel>
					{swotGenerateRunId ? (
						<DesktopAppSurface variant="soft" className="space-y-1 p-3">
							<div className="text-sm text-(--desktop-text-secondary)">
								{t('cabinetPage.jtbd.aiRunStatusPrefix')}{' '}
								{localizeStatus(
									swotGenerateRunQuery.data?.queue?.status ||
										swotGenerateRunQuery.data?.run.status ||
										'processing'
								)}
							</div>
							<div className={cn(DESKTOP_TYPOGRAPHY.meta)}>
								{t('cabinetPage.jtbd.aiRunQueueLine', {
									waiting:
										swotGenerateRunQuery.data?.queue?.waiting_count ?? '...',
									processing:
										swotGenerateRunQuery.data?.queue?.processing_count ?? '...',
								})}
							</div>
						</DesktopAppSurface>
					) : null}
					{swotQuery.isLoading ? (
						<LoadingGrid />
					) : swotQuery.isError ? (
						<DesktopAppErrorState
							message={extractApiErrorMessage(
								swotQuery.error,
								t('cabinetPage.analysis.loadSwotError')
							)}
							onAction={() => void swotQuery.refetch()}
						/>
					) : swotItems.length > 0 ? (
						swotItems.length > MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD ? (
							<div className="space-y-2">
								<p className={cn('mc-meta-caption', DESKTOP_TYPOGRAPHY.meta)}>
									{swotFetchTruncated
										? t('cabinetPage.listFetchSummaryTruncated', {
												shown: swotItems.length,
												total: swotDbTotal,
											})
										: t('cabinetPage.analysis.swotListCount', {
												count: swotItems.length,
											})}
								</p>
								<VirtualVariableList
									items={swotItems}
									estimateSize={() => 300}
									getItemKey={(index) =>
										swotItems[index]?.id ?? `swot-${index}`
									}
									height={420}
									overscanCount={5}
									className="rounded-(--desktop-radius)"
									renderItem={(swot) => (
										<div className="pb-3">
											{renderSwotAnalysisCard(swot, { virtualized: true })}
										</div>
									)}
								/>
							</div>
						) : (
							<div className="space-y-3">
								{swotFetchTruncated ? (
									<p className={cn('mc-meta-caption', DESKTOP_TYPOGRAPHY.meta)}>
										{t('cabinetPage.listFetchSummaryTruncated', {
											shown: swotItems.length,
											total: swotDbTotal,
										})}
									</p>
								) : null}
								{swotItems.map((swot) => (
									<div key={swot.id}>{renderSwotAnalysisCard(swot)}</div>
								))}
							</div>
						)
					) : (
						<DesktopAppEmptyState
							title={t('cabinetPage.analysis.swotEmptyTitle')}
							description={t('cabinetPage.analysis.swotEmptyDescription')}
						/>
					)}
				</SectionPanel>

				<SectionPanel
					title={t('cabinetPage.analysis.manualTitle')}
					description={t('cabinetPage.analysis.manualDescription')}
					helpBlockId="analysis.swot_manual"
				>
					<form className="space-y-3" onSubmit={handleCreateSwot}>
						<FieldLabel
							label={t('cabinetPage.analysis.fieldSwotTitle')}
							required
						>
							<DesktopAppInput
								value={swotManualForm.title}
								onChange={(event) =>
									setSwotManualForm((prev) => ({
										...prev,
										title: event.target.value,
									}))
								}
								placeholder={t('cabinetPage.analysis.phSwotTitle')}
							/>
						</FieldLabel>
						<FieldLabel label={t('cabinetPage.analysis.fieldExecutiveSummary')}>
							<textarea
								className={TEXTAREA_CLASS}
								value={swotManualForm.executive_summary}
								onChange={(event) =>
									setSwotManualForm((prev) => ({
										...prev,
										executive_summary: event.target.value,
									}))
								}
								placeholder={t('cabinetPage.analysis.phExecutiveSummary')}
							/>
						</FieldLabel>
						<div className="grid gap-3 xl:grid-cols-2">
							<FieldLabel
								label={t('cabinetPage.analysis.fieldStrengths')}
								hint={t('cabinetPage.analysis.hintOnePerLine')}
							>
								<textarea
									className={TEXTAREA_CLASS}
									value={swotManualForm.strengths}
									onChange={(event) =>
										setSwotManualForm((prev) => ({
											...prev,
											strengths: event.target.value,
										}))
									}
									placeholder={t('cabinetPage.analysis.phStrengths')}
								/>
							</FieldLabel>
							<FieldLabel
								label={t('cabinetPage.analysis.fieldWeaknesses')}
								hint={t('cabinetPage.analysis.hintOnePerLine')}
							>
								<textarea
									className={TEXTAREA_CLASS}
									value={swotManualForm.weaknesses}
									onChange={(event) =>
										setSwotManualForm((prev) => ({
											...prev,
											weaknesses: event.target.value,
										}))
									}
									placeholder={t('cabinetPage.analysis.phWeaknesses')}
								/>
							</FieldLabel>
							<FieldLabel
								label={t('cabinetPage.analysis.fieldOpportunities')}
								hint={t('cabinetPage.analysis.hintOnePerLine')}
							>
								<textarea
									className={TEXTAREA_CLASS}
									value={swotManualForm.opportunities}
									onChange={(event) =>
										setSwotManualForm((prev) => ({
											...prev,
											opportunities: event.target.value,
										}))
									}
									placeholder={t('cabinetPage.analysis.phOpportunities')}
								/>
							</FieldLabel>
							<FieldLabel
								label={t('cabinetPage.analysis.fieldThreats')}
								hint={t('cabinetPage.analysis.hintOnePerLine')}
							>
								<textarea
									className={TEXTAREA_CLASS}
									value={swotManualForm.threats}
									onChange={(event) =>
										setSwotManualForm((prev) => ({
											...prev,
											threats: event.target.value,
										}))
									}
									placeholder={t('cabinetPage.analysis.phThreats')}
								/>
							</FieldLabel>
						</div>
						<DesktopAppButton
							type="submit"
							variant="accent"
							disabled={!selectedProjectId || createSwotMutation.isPending}
						>
							{createSwotMutation.isPending ? (
								<ArrowPathIcon
									className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							) : (
								<ShieldCheckIcon
									className="h-4 w-4"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							)}
							{t('cabinetPage.analysis.submitManualSwot')}
						</DesktopAppButton>
					</form>
				</SectionPanel>
			</div>

			<div className="grid gap-6 xl:gap-6">
				<SectionPanel
					title={t('cabinetPage.analysis.competitorsTitle')}
					description={t('cabinetPage.analysis.competitorsDescription')}
					helpBlockId="analysis.competitors"
					actions={
						<div className="flex items-center gap-2">
							<DesktopAppInput
								placeholder={t(
									'cabinetPage.analysis.competitorSearchPlaceholder'
								)}
								value={competitorSearch}
								onChange={(e) => setCompetitorSearch(e.target.value)}
								aria-label={t('cabinetPage.analysis.competitorSearchAria')}
								className="w-56"
							/>
							{competitorSearch.trim() ? (
								<DesktopAppButton
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => setCompetitorSearch('')}
									aria-label={t('evidenceView.clearSearchAria')}
								>
									<PaintBrushIcon
										className="h-3.5 w-3.5"
										strokeWidth={DESKTOP_LUCIDE.stroke}
									/>
								</DesktopAppButton>
							) : null}
							{filteredCompetitors.length > 0 ? (
								<>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										onClick={handleCopyAllCompetitors}
										aria-label={t('cabinetPage.analysis.copyCompetitorsAria')}
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
										onClick={handleExportCompetitors}
										aria-label={t('cabinetPage.analysis.exportCompetitorsAria')}
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
										targetSection="competitors"
										allowMarketingWrite={allowMarketingWrite}
										invalidateQueryKeys={[
											marketingCabinetProjectSectionInvalidationQueryKey(
												'competitors',
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
										targetSection="competitors"
										targetLabel={t(
											'cabinetPage.analysis.competitorDocAutofillLabel'
										)}
										invalidateQueryKeys={[
											marketingCabinetProjectSectionInvalidationQueryKey(
												'competitors',
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
					{competitorsQuery.isLoading ? (
						<LoadingGrid />
					) : competitorsQuery.isError ? (
						<DesktopAppErrorState
							message={extractApiErrorMessage(
								competitorsQuery.error,
								t('cabinetPage.analysis.loadCompetitorsError')
							)}
							onAction={() => void competitorsQuery.refetch()}
						/>
					) : (
						<>
							{competitors.length > 0 ? (
								<div className="mb-3 flex flex-wrap gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle)/80 bg-(--desktop-surface-soft)/40 p-2">
									<div className="min-w-36 flex-1">
										<MarketingCabinetSelect
											size="compact"
											value={dashboardCompetitorFilters.competitor_type}
											aria-label={t(
												'overview.dashboard.listFilter.competitorTypeAria'
											)}
											options={[
												{
													value: '',
													label: t('overview.dashboard.listFilter.all'),
												},
												...competitorTypeSelectOptions,
											]}
											onChange={(v) =>
												setCompetitorUrlFilter(MC_OPS_COMPETITOR_TYPE, v)
											}
										/>
									</div>
								</div>
							) : null}
							{filteredCompetitors.length > 0 ? (
								filteredCompetitors.length >
								MARKETING_SECTION_LIST_VIRTUAL_THRESHOLD ? (
									<div className="space-y-2">
										<div className={cn(DESKTOP_TYPOGRAPHY.meta)}>
											{competitors.length > filteredCompetitors.length
												? t(
														'cabinetPage.analysis.competitorListSummaryPartial',
														{
															shown: filteredCompetitors.length,
															total: competitors.length,
														}
													)
												: competitorsFetchTruncated
													? t('cabinetPage.listFetchSummaryTruncated', {
															shown: competitors.length,
															total: competitorsDbTotal,
														})
													: t('cabinetPage.analysis.competitorListSummaryAll', {
															count: filteredCompetitors.length,
														})}
										</div>
										<VirtualVariableList
											items={filteredCompetitors}
											estimateSize={() => 180}
											getItemKey={(index) =>
												filteredCompetitors[index]?.id ?? `comp-${index}`
											}
											height={420}
											overscanCount={5}
											className="rounded-(--desktop-radius)"
											renderItem={(competitor) => (
												<div className="pb-3">
													{renderCompetitorCard(competitor)}
												</div>
											)}
										/>
									</div>
								) : (
									<div className="space-y-3">
										{competitors.length > filteredCompetitors.length ||
										competitorsFetchTruncated ? (
											<div className={cn(DESKTOP_TYPOGRAPHY.meta)}>
												{competitors.length > filteredCompetitors.length
													? t(
															'cabinetPage.analysis.competitorListSummaryPartial',
															{
																shown: filteredCompetitors.length,
																total: competitors.length,
															}
														)
													: t('cabinetPage.listFetchSummaryTruncated', {
															shown: competitors.length,
															total: competitorsDbTotal,
														})}
											</div>
										) : null}
										{filteredCompetitors.map((competitor) => (
											<div key={competitor.id}>
												{renderCompetitorCard(competitor)}
											</div>
										))}
									</div>
								)
							) : competitors.length > 0 ? (
								<div className="space-y-3 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-6 text-center shadow-(--desktop-shadow-soft)">
									<p className="text-sm text-(--desktop-text-secondary)">
										{debouncedCompetitorSearch.trim()
											? t(
													'cabinetPage.analysis.competitorSearchEmptyDescription',
													{
														query: debouncedCompetitorSearch,
													}
												)
											: t(
													'cabinetPage.analysis.competitorFilterOpsEmptyDescription'
												)}
									</p>
									<DesktopAppButton
										type="button"
										variant="ghost"
										size="sm"
										onClick={clearCompetitorListFilters}
									>
										{t('cabinetPage.jtbd.resetSearch')}
									</DesktopAppButton>
								</div>
							) : (
								<DesktopAppEmptyState
									title={t('cabinetPage.analysis.competitorsEmptyTitle')}
									description={t(
										'cabinetPage.analysis.competitorsEmptyDescription'
									)}
								/>
							)}
						</>
					)}
				</SectionPanel>

				<SectionPanel
					title={t('cabinetPage.analysis.addCompetitorTitle')}
					description={t('cabinetPage.analysis.addCompetitorDescription')}
					helpBlockId="analysis.competitor_form"
				>
					<form className="space-y-3" onSubmit={handleCreateCompetitor}>
						<FieldLabel label={t('cabinetPage.analysis.fieldName')} required>
							<DesktopAppInput
								value={competitorForm.name}
								onChange={(event) =>
									setCompetitorForm((prev) => ({
										...prev,
										name: event.target.value,
									}))
								}
								placeholder={t('cabinetPage.analysis.phCompetitorName')}
							/>
						</FieldLabel>
						<div className={INPUT_STACK_CLASS}>
							<FieldLabel label={t('cabinetPage.analysis.fieldWebsite')}>
								<DesktopAppInput
									value={competitorForm.website}
									onChange={(event) =>
										setCompetitorForm((prev) => ({
											...prev,
											website: event.target.value,
										}))
									}
									placeholder={t('cabinetPage.analysis.phCompetitorWebsite')}
									aria-invalid={
										competitorForm.website.trim()
											? !isValidUrl(competitorForm.website)
											: undefined
									}
								/>
								{competitorForm.website.trim() &&
								!isValidUrl(competitorForm.website) ? (
									<span className="mt-1 block text-xs text-[rgb(var(--desktop-accent-rgb)/0.92)]">
										{t('cabinetPage.analysis.websiteInvalidShort')}
									</span>
								) : null}
							</FieldLabel>
							<FieldLabel label={t('cabinetPage.analysis.fieldType')}>
								<MarketingCabinetSelect
									value={competitorForm.competitor_type}
									onChange={(v) =>
										setCompetitorForm((prev) => ({
											...prev,
											competitor_type: v,
										}))
									}
									options={competitorTypeSelectOptions}
								/>
							</FieldLabel>
						</div>
						<div className={INPUT_STACK_CLASS}>
							<FieldLabel label={t('cabinetPage.analysis.fieldMarketPosition')}>
								<DesktopAppInput
									value={competitorForm.market_position}
									onChange={(event) =>
										setCompetitorForm((prev) => ({
											...prev,
											market_position: event.target.value,
										}))
									}
									placeholder={t('cabinetPage.analysis.phMarketPosition')}
								/>
							</FieldLabel>
							<FieldLabel label={t('cabinetPage.analysis.fieldPricing')}>
								<DesktopAppInput
									value={competitorForm.pricing_strategy}
									onChange={(event) =>
										setCompetitorForm((prev) => ({
											...prev,
											pricing_strategy: event.target.value,
										}))
									}
									placeholder={t('cabinetPage.analysis.phPricing')}
								/>
							</FieldLabel>
						</div>
						<FieldLabel
							label={t('cabinetPage.analysis.fieldCompetitorDescription')}
						>
							<textarea
								className={TEXTAREA_CLASS}
								value={competitorForm.description}
								onChange={(event) =>
									setCompetitorForm((prev) => ({
										...prev,
										description: event.target.value,
									}))
								}
								placeholder={t('cabinetPage.analysis.phCompetitorWhy')}
							/>
						</FieldLabel>
						<div className="grid gap-3 xl:grid-cols-2">
							<FieldLabel
								label={t('cabinetPage.analysis.fieldCompStrengths')}
								hint={t('cabinetPage.analysis.strengthsHint')}
							>
								<textarea
									className={TEXTAREA_CLASS}
									value={competitorForm.strengths}
									onChange={(event) =>
										setCompetitorForm((prev) => ({
											...prev,
											strengths: event.target.value,
										}))
									}
									placeholder={t('cabinetPage.analysis.phCompStrengths')}
								/>
							</FieldLabel>
							<FieldLabel
								label={t('cabinetPage.analysis.fieldCompWeaknesses')}
								hint={t('cabinetPage.analysis.strengthsHint')}
							>
								<textarea
									className={TEXTAREA_CLASS}
									value={competitorForm.weaknesses}
									onChange={(event) =>
										setCompetitorForm((prev) => ({
											...prev,
											weaknesses: event.target.value,
										}))
									}
									placeholder={t('cabinetPage.analysis.phCompWeaknesses')}
								/>
							</FieldLabel>
						</div>
						<DesktopAppButton
							type="submit"
							variant="accent"
							disabled={
								createCompetitorMutation.isPending ||
								!competitorForm.name.trim()
							}
						>
							{createCompetitorMutation.isPending ? (
								<ArrowPathIcon
									className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							) : (
								<UserGroupIcon
									className="h-4 w-4"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							)}
							{t('cabinetPage.analysis.submitAddCompetitor')}
						</DesktopAppButton>
					</form>
				</SectionPanel>
			</div>
		</div>
	);
}
