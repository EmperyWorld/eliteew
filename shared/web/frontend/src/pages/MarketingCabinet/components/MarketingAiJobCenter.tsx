/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Toolbar popover for marketing AI and IMC job runs (badge + list on demand).
 *
 * Invariants:
 * - Full list queries run only while the popover is open.
 * - Dropdown panel portals above toolbar (fixed position), not inside `overflow-x-hidden` header.
 * - Project and company badges use `*-live-jobs-summary` (deduped with entity hooks on project scope).
 * - Poll after hover/focus or on working tabs.
 *
 * Related:
 * - MarketingCabinetToolbar.tsx
 */
import type { ImcResearchRunSummary } from '@/types/imc';
import { cn } from '@/utils/cn';
import { useQuery } from '@tanstack/react-query';
import {
	ArrowPathIcon,
	ChevronDownIcon,
	QueueListIcon,
} from '@heroicons/react/24/outline';
import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
	type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';
import { DesktopAppButton } from '../../Desktop/components/DesktopAppChrome';
import { getMarketingCabinetPortalRoot } from '../utils/getMarketingCabinetPortalRoot';
import { computeMarketingAiJobCenterPanelStyle } from '../utils/marketingAiJobCenterPanelPosition';
import { useMarketingDialogFocusTrap } from '../hooks/useMarketingDialogFocusTrap';
import { useMarketingShellClasses } from '../hooks/useMarketingShellClasses';
import { MARKETING_LIVE_QUERY_OPTIONS, type MarketingView } from '../constants';
import { marketingCabinetShouldPollActiveAiRuns } from '../marketingCabinetDashboardGating';
import {
	marketingCabinetLiveJobsSummaryActiveTotal,
	marketingCabinetProjectLiveJobsPollIntervalMs,
} from '../utils/marketingCabinetLiveJobsCounts';
import {
	formatDateTime,
	localizeMarketingAiTool,
	localizeStatus,
} from '../locales';
import { type MarketingAiRun } from '../marketingCabinetApi';
import {
	marketingCabinetAiJobCenterRunsQueryOptions,
	marketingCabinetCompanyLiveJobsSummaryQueryOptions,
	marketingCabinetImcJobCenterRunsQueryOptions,
	marketingCabinetProjectLiveJobsSummaryQueryOptions,
} from '../marketingCabinetQueryOptions';
import {
	marketingAiRunFocusEntityId,
	marketingAiRunTargetView,
} from '../utils/marketingAiJobCenter';

type StatusFilter = 'active' | 'all';

export interface MarketingAiJobCenterProps {
	activeView: MarketingView;
	selectedProjectId: string | null;
	selectedCompanyId: string | null;
	onNavigate: (view: MarketingView, focusEntityId: string | null) => void;
}

export function MarketingAiJobCenter({
	activeView,
	selectedProjectId,
	selectedCompanyId,
	onNavigate,
}: MarketingAiJobCenterProps) {
	const { t } = useTranslation('marketing');
	const portalStackBase = useDesktopWindowPortalStackBase();
	const { jobCenterPopover } = useMarketingShellClasses();
	const idBase = useId().replace(/:/g, '');
	const panelDomId = `${idBase}-panel`;
	const titleId = `${idBase}-title`;
	const descId = `${idBase}-desc`;
	const [open, setOpen] = useState(false);
	const [badgeEngaged, setBadgeEngaged] = useState(false);
	const [filter, setFilter] = useState<StatusFilter>('active');
	const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
	const triggerRef = useRef<HTMLButtonElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	useMarketingDialogFocusTrap(panelRef, open);

	const updatePanelPosition = useCallback(() => {
		const trigger = triggerRef.current;
		if (!trigger) return;
		setPanelStyle(
			computeMarketingAiJobCenterPanelStyle(
				trigger.getBoundingClientRect(),
				portalStackBase
			)
		);
	}, [portalStackBase]);
	const scopeParams = selectedProjectId
		? { project_id: selectedProjectId, company_id: null }
		: selectedCompanyId
			? { project_id: null, company_id: selectedCompanyId }
			: null;

	const close = useCallback(() => setOpen(false), []);

	useLayoutEffect(() => {
		if (!open) return;
		updatePanelPosition();
		const onWin = () => updatePanelPosition();
		window.addEventListener('resize', onWin);
		window.addEventListener('scroll', onWin, true);
		const ro = triggerRef.current
			? new ResizeObserver(updatePanelPosition)
			: null;
		if (triggerRef.current && ro) ro.observe(triggerRef.current);
		return () => {
			window.removeEventListener('resize', onWin);
			window.removeEventListener('scroll', onWin, true);
			ro?.disconnect();
		};
	}, [open, updatePanelPosition]);

	useEffect(() => {
		if (!open) return;
		const onDoc = (e: MouseEvent) => {
			const target = e.target;
			if (!(target instanceof Node)) return;
			if (
				triggerRef.current?.contains(target) ||
				panelRef.current?.contains(target)
			)
				return;
			close();
		};
		document.addEventListener('mousedown', onDoc, true);
		return () => document.removeEventListener('mousedown', onDoc, true);
	}, [open, close]);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') close();
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [open, close]);

	useEffect(() => {
		if (!open) return;
		const id = requestAnimationFrame(() => {
			const btn = panelRef.current?.querySelector<HTMLButtonElement>(
				`[data-job-center-filter="${filter}"]`
			);
			btn?.focus();
		});
		return () => cancelAnimationFrame(id);
	}, [open, filter]);

	const jobCenterListEnabled = Boolean(scopeParams) && open;
	const shouldShareRailPoll = marketingCabinetShouldPollActiveAiRuns(
		selectedProjectId,
		activeView
	);
	const badgePollEnabled =
		Boolean(scopeParams) && (open || badgeEngaged || shouldShareRailPoll);

	const engageBadge = useCallback(() => {
		setBadgeEngaged(true);
	}, []);

	const runsQuery = useQuery({
		...marketingCabinetAiJobCenterRunsQueryOptions({
			scopeParams,
			selectedProjectId,
			selectedCompanyId,
			filter,
		}),
		enabled: jobCenterListEnabled,
		refetchInterval: (query) => {
			if (!open) return false;
			const items = query.state.data?.items ?? [];
			const hasActive = items.some((r) =>
				['queued', 'processing'].includes(String(r.status || '').toLowerCase())
			);
			return hasActive ? 3500 : false;
		},
	});

	const imcRunsQuery = useQuery({
		...marketingCabinetImcJobCenterRunsQueryOptions({
			selectedProjectId,
			selectedCompanyId,
			filter,
		}),
		enabled: jobCenterListEnabled,
		refetchInterval: (query) => {
			if (!open) return false;
			const items = query.state.data?.items ?? [];
			const hasLive = items.some((r) =>
				['pending', 'running'].includes(String(r.status || '').toLowerCase())
			);
			return hasLive ? 3500 : false;
		},
	});

	const projectLiveJobsSummaryQuery = useQuery({
		...marketingCabinetProjectLiveJobsSummaryQueryOptions(selectedProjectId),
		enabled: badgePollEnabled && Boolean(selectedProjectId),
		...MARKETING_LIVE_QUERY_OPTIONS,
		refetchInterval: (query) => {
			if (!badgePollEnabled) return false;
			return marketingCabinetProjectLiveJobsPollIntervalMs(query.state.data);
		},
	});

	const companyLiveJobsSummaryQuery = useQuery({
		...marketingCabinetCompanyLiveJobsSummaryQueryOptions(selectedCompanyId),
		enabled:
			badgePollEnabled && Boolean(selectedCompanyId) && !selectedProjectId,
		...MARKETING_LIVE_QUERY_OPTIONS,
		refetchInterval: (query) => {
			if (!badgePollEnabled) return false;
			return marketingCabinetProjectLiveJobsPollIntervalMs(query.state.data);
		},
	});

	const badgeCount = selectedProjectId
		? marketingCabinetLiveJobsSummaryActiveTotal(
				projectLiveJobsSummaryQuery.data
			)
		: marketingCabinetLiveJobsSummaryActiveTotal(
				companyLiveJobsSummaryQuery.data
			);
	const aiItems = runsQuery.data?.items ?? [];
	const imcItems = imcRunsQuery.data?.items ?? [];

	const sectionTitle = (view: MarketingView) => t(`modules.${view}.title`);

	const handleOpenRun = (run: MarketingAiRun) => {
		const view = marketingAiRunTargetView(run.tool_key);
		const focus = marketingAiRunFocusEntityId(run);
		onNavigate(view, focus);
		close();
	};

	const handleOpenImc = (run: ImcResearchRunSummary) => {
		onNavigate('imc', run.id);
		close();
	};

	const loading = runsQuery.isLoading || imcRunsQuery.isLoading;
	const fatalError = runsQuery.isError && imcRunsQuery.isError;
	const empty =
		!loading && !fatalError && aiItems.length === 0 && imcItems.length === 0;

	if (!scopeParams) {
		return null;
	}

	const portalMount = open
		? getMarketingCabinetPortalRoot(triggerRef.current)
		: null;

	const panel =
		open && portalMount ? (
			<div
				ref={panelRef}
				id={panelDomId}
				role="menu"
				aria-labelledby={titleId}
				aria-describedby={descId}
				data-marketing-cabinet-shell
				data-desktop-window-ignore-context
				style={panelStyle}
				className={cn(
					jobCenterPopover,
					'flex flex-col shadow-(--desktop-shadow-panel) ring-1 ring-black/20'
				)}
			>
				<h2 id={titleId} className="sr-only">
					{t('jobCenter.dialogTitle')}
				</h2>
				<p id={descId} className="sr-only">
					{t('jobCenter.dialogDescription')}
				</p>
				<div className="flex items-center gap-1 border-b border-(--desktop-border-subtle) bg-(--desktop-surface-soft)/30 p-2">
					{(['active', 'all'] as const).map((key) => (
						<DesktopAppButton
							key={key}
							type="button"
							size="sm"
							variant={filter === key ? 'accent' : 'ghost'}
							className="flex-1 text-xs"
							data-job-center-filter={key}
							role="menuitemradio"
							aria-checked={filter === key}
							onClick={() => setFilter(key)}
						>
							{key === 'active'
								? t('jobCenter.filterActive')
								: t('jobCenter.filterAll')}
						</DesktopAppButton>
					))}
				</div>
				<div className="max-h-[min(60vh,320px)] overflow-y-auto p-2">
					{loading ? (
						<div className="flex items-center justify-center gap-2 py-8 text-sm text-(--desktop-text-muted) antialiased">
							<ArrowPathIcon
								className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none"
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
							{t('jobCenter.loading')}
						</div>
					) : fatalError ? (
						<div className="py-6 text-center text-sm text-(--desktop-text-muted) antialiased">
							{t('jobCenter.error')}
						</div>
					) : empty ? (
						<div className="py-6 text-center text-sm text-(--desktop-text-muted) antialiased">
							{t('jobCenter.empty')}
						</div>
					) : (
						<div className="space-y-3">
							{runsQuery.isError ? (
								<p
									className={cn(
										DESKTOP_TYPOGRAPHY.caption,
										'px-1 text-center text-(--desktop-text-secondary)'
									)}
								>
									{t('jobCenter.partialAiError')}
								</p>
							) : null}
							{imcRunsQuery.isError ? (
								<p
									className={cn(
										DESKTOP_TYPOGRAPHY.caption,
										'px-1 text-center text-(--desktop-text-secondary)'
									)}
								>
									{t('jobCenter.partialImcError')}
								</p>
							) : null}
							{aiItems.length > 0 ? (
								<div>
									<div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-(--desktop-text-dim)">
										{t('jobCenter.sectionAi')}
									</div>
									<ul className="space-y-1.5">
										{aiItems.map((run) => {
											const view = marketingAiRunTargetView(run.tool_key);
											const st = String(run.status || '').toLowerCase();
											const isLive = st === 'queued' || st === 'processing';
											return (
												<li key={run.id}>
													<button
														type="button"
														role="menuitem"
														onClick={() => handleOpenRun(run)}
														className={cn(
															'w-full rounded-(--desktop-radius) border border-transparent px-2.5 py-2 text-left transition-colors',
															'hover:border-(--desktop-border-subtle) hover:bg-(--desktop-surface-soft-hover)',
															isLive &&
																'border-(--mc-accent-25) bg-(--mc-accent-05)'
														)}
													>
														<div className="flex items-start justify-between gap-2">
															<span className="text-sm font-medium leading-snug text-(--desktop-text-primary)">
																{localizeMarketingAiTool(run.tool_key)}
															</span>
															<span
																className={cn(
																	'shrink-0',
																	DESKTOP_TYPOGRAPHY.caption
																)}
															>
																{localizeStatus(run.status)}
															</span>
														</div>
														<div
															className={cn(
																'mt-0.5',
																DESKTOP_TYPOGRAPHY.caption
															)}
														>
															→ {sectionTitle(view)}
														</div>
														{run.prompt_excerpt ? (
															<div className="mt-1 line-clamp-2 text-xs text-(--desktop-text-secondary)">
																{run.prompt_excerpt}
															</div>
														) : null}
														<div
															className={cn('mt-1', DESKTOP_TYPOGRAPHY.small)}
														>
															{formatDateTime(run.started_at || run.created_at)}
														</div>
													</button>
												</li>
											);
										})}
									</ul>
								</div>
							) : null}
							{imcItems.length > 0 ? (
								<div>
									<div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-(--desktop-text-dim)">
										{t('jobCenter.sectionImc')}
									</div>
									<ul className="space-y-1.5">
										{imcItems.map((run) => {
											const st = String(run.status || '').toLowerCase();
											const isLive = st === 'pending' || st === 'running';
											return (
												<li key={run.id}>
													<button
														type="button"
														role="menuitem"
														onClick={() => handleOpenImc(run)}
														className={cn(
															'w-full rounded-(--desktop-radius) border border-transparent px-2.5 py-2 text-left transition-colors',
															'hover:border-(--desktop-border-subtle) hover:bg-(--desktop-surface-soft-hover)',
															isLive &&
																'border-(--mc-accent-25) bg-(--mc-accent-05)'
														)}
													>
														<div className="flex items-start justify-between gap-2">
															<span className="text-sm font-medium leading-snug text-(--desktop-text-primary)">
																{run.display_name || run.type_key}
															</span>
															<span
																className={cn(
																	'shrink-0',
																	DESKTOP_TYPOGRAPHY.caption
																)}
															>
																{localizeStatus(run.status)}
															</span>
														</div>
														<div
															className={cn(
																'mt-0.5',
																DESKTOP_TYPOGRAPHY.caption
															)}
														>
															→ {sectionTitle('imc')}
														</div>
														{run.result_preview ? (
															<div className="mt-1 line-clamp-2 text-xs text-(--desktop-text-secondary)">
																{run.result_preview}
															</div>
														) : null}
														<div
															className={cn('mt-1', DESKTOP_TYPOGRAPHY.small)}
														>
															{formatDateTime(run.started_at || run.created_at)}
														</div>
													</button>
												</li>
											);
										})}
									</ul>
								</div>
							) : null}
						</div>
					)}
				</div>
			</div>
		) : null;

	return (
		<>
			<DesktopAppButton
				ref={triggerRef}
				type="button"
				variant="ghost"
				size="sm"
				className={cn(
					'relative h-8 min-h-8 shrink-0 gap-1 border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-2 py-0 leading-none',
					DESKTOP_TYPOGRAPHY.caption
				)}
				onClick={() => setOpen((v) => !v)}
				onMouseEnter={engageBadge}
				onFocus={engageBadge}
				aria-expanded={open}
				aria-haspopup="menu"
				aria-controls={open ? panelDomId : undefined}
				aria-label={t('jobCenter.openAria')}
				title={t('jobCenter.openTitle')}
			>
				<QueueListIcon
					className="h-4 w-4 shrink-0"
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
				<span className="hidden max-w-36 truncate sm:inline">
					{t('jobCenter.button')}
				</span>
				{badgeCount > 0 ? (
					<span className="absolute -right-0.5 -top-0.5 z-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full border-2 border-(--desktop-surface-panel) bg-(--mc-accent) px-1 text-[11px] font-bold leading-none text-[rgb(var(--desktop-fg-primary-rgb))]">
						{badgeCount > 99 ? '99+' : badgeCount}
					</span>
				) : null}
				<ChevronDownIcon
					className={cn(
						'h-3.5 w-3.5 shrink-0 opacity-60 transition-transform',
						open && 'rotate-180'
					)}
					strokeWidth={DESKTOP_LUCIDE.stroke}
					aria-hidden
				/>
			</DesktopAppButton>
			{panel && portalMount ? createPortal(panel, portalMount) : null}
		</>
	);
}
