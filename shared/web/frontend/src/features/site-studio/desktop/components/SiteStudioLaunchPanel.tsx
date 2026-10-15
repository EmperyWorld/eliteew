/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Launch control surface for Site Studio: readiness N/4, runtime metrics, provision/start/stop/redeploy/publish actions.
 *
 * Invariants:
 * - Runtime guardrails come from `computeSiteStudioRuntimeGuards`; actions dispatch only via `onRunAction`.
 * - Edge visitor CTA respects `edgeLive` when edge mode is enabled.
 *
 * Related:
 * - `SiteStudioRuntimePanel.tsx`
 * - `siteStudioRuntimeGuards.ts`
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	DESKTOP_APP_STYLE_CONTRACT,
	DesktopAppButton,
	DesktopAppSurface,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { RuntimeDisabledActionsHintCard } from '@/pages/Desktop/components/RuntimeDisabledActionsHintCard';
import { telemetryRuntimeDisabledReasonsToggle } from '@/pages/Desktop/utils/desktopTelemetry';
import {
	ArrowPathIcon,
	ArrowTopRightOnSquareIcon,
	DocumentDuplicateIcon,
	GlobeAltIcon,
	PlayIcon,
	RocketLaunchIcon,
	ShieldCheckIcon,
	Square2StackIcon,
} from '@heroicons/react/24/outline';

import type {
	SiteStudioDraftState,
	SiteStudioHealth,
	SiteStudioInstance,
} from '../api';
import { computeSiteStudioRuntimeGuards } from './siteStudioRuntimeGuards';
import {
	computeSiteStudioEdgeState,
	FIELD_ITEMS,
	formatHealthState,
	formatLifecycleJobSummary,
	formatRuntimeState,
	getNextStepHint,
	readinessDotTone,
	readinessTone,
	resolveActionTooltip,
	type RuntimeReadinessItem,
} from './siteStudioRuntimeShared';

export interface SiteStudioLaunchPanelProps {
	instance: SiteStudioInstance;
	health: SiteStudioHealth | null;
	drafts: SiteStudioDraftState | null;
	canOpenAdminShell: boolean;
	busyKeys: Set<string>;
	onRunAction: (
		action:
			| 'provision'
			| 'start'
			| 'stop'
			| 'redeploy'
			| 'publish'
			| 'unpublish'
	) => void;
	onOpenPublic: () => void;
	onOpenAdmin: () => void;
	onCopy: (value: string, label: string) => void;
}

export const SiteStudioLaunchPanel: React.FC<SiteStudioLaunchPanelProps> = ({
	instance,
	health,
	drafts,
	canOpenAdminShell,
	busyKeys,
	onRunAction,
	onOpenPublic,
	onOpenAdmin,
	onCopy,
}) => {
	const { t } = useTranslation('siteStudio');
	const runtimeGuards = React.useMemo(
		() =>
			computeSiteStudioRuntimeGuards({
				instanceStatus: instance.status,
				healthStatus: health?.status,
				publicationState: instance.publication_state,
				busyKeys,
			}),
		[busyKeys, health?.status, instance.publication_state, instance.status]
	);
	const isPublished = runtimeGuards.isPublished;
	const { edgeLive } = computeSiteStudioEdgeState(health, isPublished);
	const nextStepHint = getNextStepHint(instance, health, drafts, t);
	const activeJobSummary = formatLifecycleJobSummary(
		t,
		health?.pending_job ?? null
	);
	const lastJobSummary = formatLifecycleJobSummary(t, health?.last_job ?? null);
	const readinessItems = React.useMemo<RuntimeReadinessItem[]>(
		() => [
			{
				id: 'content',
				ready: Boolean(
					drafts?.siteBlueprint &&
						drafts.contentDrafts.length > 0 &&
						drafts.imageDrafts.length > 0
				),
				labelKey: 'runtime.readinessContent',
				readyKey: 'runtime.readinessContentReady',
				pendingKey: 'runtime.readinessContentPending',
			},
			{
				id: 'runtime',
				ready: runtimeGuards.isRunning,
				labelKey: 'runtime.readinessRuntime',
				readyKey: 'runtime.readinessRuntimeReady',
				pendingKey: 'runtime.readinessRuntimePending',
			},
			{
				id: 'publication',
				ready: health?.edge?.enabled
					? edgeLive
					: isPublished && Boolean(instance.public_url),
				labelKey: 'runtime.readinessPublication',
				readyKey: health?.edge?.enabled
					? 'runtime.readinessEdgeLiveReady'
					: 'runtime.readinessPublicationReady',
				pendingKey: health?.edge?.enabled
					? 'runtime.readinessEdgeLivePending'
					: 'runtime.readinessPublicationPending',
			},
			{
				id: 'management',
				ready: canOpenAdminShell,
				labelKey: 'runtime.readinessManagement',
				readyKey: 'runtime.readinessManagementReady',
				pendingKey: 'runtime.readinessManagementPending',
			},
		],
		[
			canOpenAdminShell,
			drafts?.contentDrafts.length,
			drafts?.imageDrafts.length,
			drafts?.siteBlueprint,
			edgeLive,
			health?.edge?.enabled,
			instance.public_url,
			isPublished,
			runtimeGuards.isRunning,
		]
	);
	const readyStepCount = readinessItems.filter((item) => item.ready).length;
	const nextReadinessItem = readinessItems.find((item) => !item.ready) ?? null;
	const provisionTooltip = resolveActionTooltip(
		t,
		'runtime.actionProvisionTooltip',
		runtimeGuards.provision
	);
	const startTooltip = resolveActionTooltip(
		t,
		'runtime.actionStartTooltip',
		runtimeGuards.start
	);
	const stopTooltip = resolveActionTooltip(
		t,
		'runtime.actionStopTooltip',
		runtimeGuards.stop
	);
	const redeployTooltip = resolveActionTooltip(
		t,
		'runtime.actionRedeployTooltip',
		runtimeGuards.redeploy
	);
	const publishTooltip = runtimeGuards.publishToggle.disabled
		? resolveActionTooltip(
				t,
				isPublished
					? 'runtime.actionCloseSiteTooltip'
					: 'runtime.actionOpenSiteTooltip',
				runtimeGuards.publishToggle
			)
		: isPublished
			? t('runtime.actionCloseSiteTooltip')
			: t('runtime.actionOpenSiteTooltip');
	const disabledActionHints = React.useMemo(() => {
		const hints: string[] = [];
		if (runtimeGuards.provision.disabled) {
			hints.push(`${t('runtime.actionProvision')}: ${provisionTooltip}`);
		}
		if (runtimeGuards.start.disabled) {
			hints.push(`${t('runtime.actionStart')}: ${startTooltip}`);
		}
		if (runtimeGuards.stop.disabled) {
			hints.push(`${t('runtime.actionStop')}: ${stopTooltip}`);
		}
		if (runtimeGuards.redeploy.disabled) {
			hints.push(`${t('runtime.actionRedeploy')}: ${redeployTooltip}`);
		}
		if (runtimeGuards.publishToggle.disabled) {
			hints.push(
				`${isPublished ? t('runtime.actionCloseSite') : t('runtime.actionOpenSite')}: ${publishTooltip}`
			);
		}
		return hints;
	}, [
		isPublished,
		provisionTooltip,
		publishTooltip,
		redeployTooltip,
		runtimeGuards.provision.disabled,
		runtimeGuards.publishToggle.disabled,
		runtimeGuards.redeploy.disabled,
		runtimeGuards.start.disabled,
		runtimeGuards.stop.disabled,
		startTooltip,
		stopTooltip,
		t,
	]);
	const handleRuntimeHintsToggle = React.useCallback(
		(payload: {
			isExpanded: boolean;
			rawCount: number;
			collapsedCount: number;
			hiddenCount: number;
		}) => {
			telemetryRuntimeDisabledReasonsToggle({
				surface: 'site_studio',
				expanded: payload.isExpanded,
				rawCount: payload.rawCount,
				collapsedCount: payload.collapsedCount,
				hiddenCount: payload.hiddenCount,
			});
		},
		[]
	);

	return (
		<>
			<section
				className="space-y-2"
				aria-labelledby="site-studio-launch-control-title"
			>
				<h2
					id="site-studio-launch-control-title"
					className={DESKTOP_APP_STYLE_CONTRACT.sectionLabel}
				>
					{t('runtime.title')}
				</h2>
				<p className="text-sm leading-6 text-(--desktop-text-secondary)">
					{nextStepHint}
				</p>
			</section>

			<DesktopAppSurface variant="soft" padding="sm" className="space-y-3">
				<div>
					<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
						{t('runtime.readinessTitle')}
					</div>
					<p className="mt-1 text-xs leading-5 text-(--desktop-text-secondary)">
						{t('runtime.readinessDescription')}
					</p>
				</div>
				<div
					className={`rounded-(--desktop-radius) border p-3 ${
						nextReadinessItem
							? 'border-amber-400/25 bg-amber-500/8'
							: 'border-emerald-400/25 bg-emerald-500/8'
					}`}
				>
					<div className="text-sm font-medium text-(--desktop-text-primary)">
						{t('runtime.readinessProgressSummary', {
							done: readyStepCount,
							total: readinessItems.length,
						})}
					</div>
					<p className="mt-1 text-xs leading-5 text-(--desktop-text-secondary)">
						{nextReadinessItem
							? t('runtime.readinessNextStep', {
									step: t(nextReadinessItem.labelKey),
								})
							: t('runtime.readinessAllReady')}
					</p>
				</div>
				<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
					{readinessItems.map((item) => (
						<div
							key={item.id}
							className={`rounded-(--desktop-radius) border p-3 ${readinessTone(item.ready)}`}
						>
							<div className="flex items-center justify-between gap-2">
								<div className="flex min-w-0 items-center gap-2">
									<span
										className={`h-2.5 w-2.5 shrink-0 rounded-full ${readinessDotTone(item.ready)}`}
										aria-hidden
									/>
									<div className="truncate text-sm font-medium text-(--desktop-text-primary)">
										{t(item.labelKey)}
									</div>
								</div>
								<span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-(--desktop-text-dim)">
									{item.ready
										? t('runtime.readinessDone')
										: t('runtime.readinessNeedsWork')}
								</span>
							</div>
							<p className="mt-2 text-xs leading-5 text-(--desktop-text-secondary)">
								{t(item.ready ? item.readyKey : item.pendingKey)}
							</p>
						</div>
					))}
				</div>
			</DesktopAppSurface>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				<DesktopAppSurface variant="soft" padding="sm">
					<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
						{t('runtime.metricRuntime')}
					</div>
					<div className="mt-2 text-base font-medium text-(--desktop-text-primary)">
						{formatRuntimeState(
							t,
							health?.status === 'running' ? 'running' : instance.status
						)}
					</div>
				</DesktopAppSurface>
				<DesktopAppSurface variant="soft" padding="sm">
					<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
						{t('runtime.metricApi')}
					</div>
					<div className="mt-2 text-base font-medium text-(--desktop-text-primary)">
						{formatHealthState(t, health?.api_ok, health?.api_error)}
					</div>
				</DesktopAppSurface>
				<DesktopAppSurface variant="soft" padding="sm">
					<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
						{t('runtime.metricPublic')}
					</div>
					<div className="mt-2 text-base font-medium text-(--desktop-text-primary)">
						{formatHealthState(t, health?.public_ok, health?.public_error)}
					</div>
				</DesktopAppSurface>
			</div>

			<DesktopAppSurface variant="soft" padding="sm" className="space-y-3">
				<div>
					<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
						{t('runtime.userActionsTitle')}
					</div>
					<p className="mt-1 text-xs leading-5 text-(--desktop-text-secondary)">
						{t('runtime.userActionsDescription')}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<DesktopAppButton
						type="button"
						variant="accent"
						disabled={runtimeGuards.provision.disabled}
						onClick={() => onRunAction('provision')}
						title={provisionTooltip}
						aria-label={provisionTooltip}
					>
						<RocketLaunchIcon className="h-4 w-4" />
						{t('runtime.actionProvision')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						disabled={runtimeGuards.start.disabled}
						onClick={() => onRunAction('start')}
						className="border-emerald-400/30 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25 active:bg-emerald-500/30"
						title={startTooltip}
						aria-label={startTooltip}
					>
						<PlayIcon className="h-4 w-4" />
						{t('runtime.actionStart')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant={isPublished ? 'danger' : 'accent'}
						className={
							isPublished
								? undefined
								: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25 active:bg-emerald-500/30'
						}
						disabled={runtimeGuards.publishToggle.disabled}
						onClick={() => onRunAction(isPublished ? 'unpublish' : 'publish')}
						title={publishTooltip}
						aria-label={publishTooltip}
					>
						<GlobeAltIcon className="h-4 w-4" />
						{isPublished
							? t('runtime.actionCloseSite')
							: t('runtime.actionOpenSite')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="ghost"
						disabled={
							health?.edge?.enabled
								? !edgeLive
								: !instance.public_url || !isPublished
						}
						onClick={onOpenPublic}
						className="border-sky-400/25 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20 active:bg-sky-500/25"
						title={
							health?.edge?.enabled
								? t('runtime.openEdgeVisitorTooltip')
								: t('runtime.openStorefrontTooltip')
						}
						aria-label={
							health?.edge?.enabled
								? t('runtime.openEdgeVisitorTooltip')
								: t('runtime.openStorefrontTooltip')
						}
						data-testid="site-studio-open-visitor"
					>
						<ArrowTopRightOnSquareIcon className="h-4 w-4" />
						{health?.edge?.enabled
							? t('runtime.openEdgeVisitor')
							: t('runtime.openStorefront')}
					</DesktopAppButton>
					<DesktopAppButton
						type="button"
						variant="ghost"
						disabled={!canOpenAdminShell}
						onClick={onOpenAdmin}
						className="border-violet-400/25 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20 active:bg-violet-500/25"
						title={t('runtime.openAdminTooltip')}
						aria-label={t('runtime.openAdminTooltip')}
					>
						<ShieldCheckIcon className="h-4 w-4" />
						{t('runtime.openAdmin')}
					</DesktopAppButton>
				</div>
				<details className="rounded-md border border-(--desktop-border-subtle) bg-(--desktop-surface)/60 p-2">
					<summary className="cursor-pointer select-none text-xs font-medium text-(--desktop-text-secondary)">
						{t('runtime.advancedActionsTitle')}
					</summary>
					<div className="mt-2 flex flex-wrap gap-2">
						<DesktopAppButton
							type="button"
							variant="danger"
							disabled={runtimeGuards.stop.disabled}
							onClick={() => onRunAction('stop')}
							title={stopTooltip}
							aria-label={stopTooltip}
						>
							<Square2StackIcon className="h-4 w-4" />
							{t('runtime.actionStop')}
						</DesktopAppButton>
						<DesktopAppButton
							type="button"
							disabled={runtimeGuards.redeploy.disabled}
							onClick={() => onRunAction('redeploy')}
							className="border-amber-400/35 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25 active:bg-amber-500/30"
							title={redeployTooltip}
							aria-label={redeployTooltip}
						>
							<ArrowPathIcon className="h-4 w-4" />
							{t('runtime.actionRedeploy')}
						</DesktopAppButton>
					</div>
				</details>
			</DesktopAppSurface>

			<DesktopAppSurface variant="soft" padding="sm" className="space-y-2">
				<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
					{t('runtime.lifecycleDiagnosticsTitle')}
				</div>
				<div className="grid gap-2 text-xs text-(--desktop-text-secondary) md:grid-cols-3">
					<div>
						<div className="text-(--desktop-text-dim)">
							{t('runtime.lifecycleWorker')}
						</div>
						<div className="mt-1 text-(--desktop-text-primary)">
							{health?.worker_ready
								? t('runtime.lifecycleWorkerReady')
								: t('runtime.lifecycleWorkerOffline')}
						</div>
						{health?.worker_last_seen_age_seconds != null ? (
							<div className="mt-1">
								{t('runtime.lifecycleWorkerSeen', {
									seconds: health.worker_last_seen_age_seconds,
								})}
							</div>
						) : null}
					</div>
					<div>
						<div className="text-(--desktop-text-dim)">
							{t('runtime.lifecyclePendingJob')}
						</div>
						<div className="mt-1 text-(--desktop-text-primary)">
							{activeJobSummary || t('runtime.lifecycleNoPendingJob')}
						</div>
						{health?.pending_job?.id ? (
							<div className="mt-1">{t('runtime.lifecycleJobActiveHint')}</div>
						) : null}
					</div>
					<div>
						<div className="text-(--desktop-text-dim)">
							{t('runtime.lifecycleLastJob')}
						</div>
						<div className="mt-1 text-(--desktop-text-primary)">
							{lastJobSummary || t('runtime.lifecycleNoLastJob')}
						</div>
						{health?.last_job?.last_error ? (
							<div className="mt-2 rounded-md border border-red-500/20 bg-red-500/8 p-2 text-red-100">
								{t('runtime.lastError', {
									message: health.last_job.last_error,
								})}
							</div>
						) : null}
					</div>
				</div>
			</DesktopAppSurface>

			<RuntimeDisabledActionsHintCard
				title={t('runtime.disabledActionsTitle')}
				hints={disabledActionHints}
				announceChanges
				showRawToggle
				groupedCountLabel={t('runtime.disabledActionsGroupedCountLabel')}
				hiddenCountLabel={t('runtime.disabledActionsHiddenCountLabel')}
				detailsCountLabel={t('runtime.disabledActionsDetailsCountLabel')}
				groupedCountSrFormatter={(count) =>
					t('runtime.disabledActionsGroupedCountSr', { count })
				}
				hiddenCountSrFormatter={(count) =>
					t('runtime.disabledActionsHiddenCountSr', { count })
				}
				summaryScrollHintLabel={t('runtime.disabledActionsSummaryScrollHint')}
				detailsScrollHintLabel={t('runtime.disabledActionsDetailsScrollHint')}
				overflowTopHintLabel={t('runtime.disabledActionsOverflowTopHint')}
				overflowBottomHintLabel={t('runtime.disabledActionsOverflowBottomHint')}
				overflowFadeStrength="strong"
				rowDensity="compact"
				scrollThreshold={5}
				rawListTitle={t('runtime.disabledActionsDetailsTitle')}
				toggleShowRawLabel={t('runtime.disabledActionsShowDetails')}
				toggleHideRawLabel={t('runtime.disabledActionsHideDetails')}
				toggleExpandedSrLabel={t('runtime.disabledActionsExpandedSr', {
					count: disabledActionHints.length,
				})}
				toggleCollapsedSrLabel={t('runtime.disabledActionsCollapsedSr', {
					count: disabledActionHints.length,
				})}
				toggleStateStorageKey="siteStudio.runtimeDisabledReasons.showDetailed"
				onToggleRawHints={handleRuntimeHintsToggle}
			/>

			<div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
				{FIELD_ITEMS.map((item) => {
					const value = String(instance[item.key] ?? '');
					const label = t(item.labelKey);
					return (
						<DesktopAppSurface
							key={item.key}
							variant="soft"
							padding="sm"
							className="space-y-2"
						>
							<div className="text-xs uppercase tracking-[0.18em] text-(--desktop-text-dim)">
								{label}
							</div>
							<div className="min-h-[44px] break-all text-sm leading-6 text-(--desktop-text-primary)">
								{value || t('runtime.notReady')}
							</div>
							{value ? (
								<DesktopAppButton
									type="button"
									size="sm"
									variant="ghost"
									onClick={() => onCopy(value, label)}
								>
									<DocumentDuplicateIcon className="h-3.5 w-3.5" />
									{t('runtime.copy')}
								</DesktopAppButton>
							) : null}
						</DesktopAppSurface>
					);
				})}
			</div>

			{instance.last_error ? (
				<DesktopAppSurface
					variant="soft"
					padding="sm"
					className="border border-red-500/20 bg-red-500/8 text-sm text-red-100"
				>
					{t('runtime.lastError', { message: instance.last_error })}
				</DesktopAppSurface>
			) : null}
		</>
	);
};

export default SiteStudioLaunchPanel;
