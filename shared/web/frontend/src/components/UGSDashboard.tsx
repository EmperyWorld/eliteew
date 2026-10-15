/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS operational dashboard: live stats, provider health, active tasks, quick links.
 *
 * Invariants:
 * - User-scoped data via useUgsDashboard; admin-only shortcuts unchanged.
 *
 * Related:
 * - pages/Desktop/components/UGSDesktopContainer.tsx
 * - components/UGS/workspace/UgsWorkspaceShell.tsx
 */

import { guideTourLabelsFromI18n } from '@/components/guided-tour/guideTourLabelsFromI18n';
import { SpotlightGuideModal } from '@/components/guided-tour/SpotlightGuideModal';
import { useBuiltGuideSteps } from '@/components/guided-tour/useBuiltGuideSteps';
import {
	UgsHubSectionHeading,
	ugsHubHeaderBtnClasses,
	ugsHubIconTileClasses,
	ugsHubInsetRowClasses,
	ugsHubPanelClasses,
	ugsHubTextMuted,
	ugsHubTextPrimary,
	ugsHubTextSecondary,
} from '@/components/UGS/hub/ugsHubSharedUi';
import {
	ugsHubStatusBadgeClasses,
	ugsHubStatusLabel,
} from '@/components/UGS/hub/ugsHubTaskListMeta';
import { UgsMetricCard } from '@/components/UGS/workspace/UgsMetricCard';
import { UgsWorkspaceLoading } from '@/components/UGS/workspace/UgsWorkspaceLoading';
import { UgsWorkspaceShell } from '@/components/UGS/workspace/UgsWorkspaceShell';
import { RetryBlock } from '@/components/ui/RetryBlock';
import {
	UGS_WORKSPACE_SEMANTIC,
	ugsWorkspaceShortcutTileClass,
} from '@/features/ugs/shared/ugsDesktopUi';
import { useUgsDashboard } from '@/hooks/api/useUgsDashboard';
import { useDesktopShellTheme } from '@/hooks/useDesktopShellTheme';
import { useDesktopGuideTourOpener } from '@/pages/Desktop/hooks/useDesktopGuideTourOpener';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { fetchUgsMetrics } from '@/services/api/ugs/dashboard';
import { cn } from '@/utils/cn';
import { humanizeUgsTypeKey } from '@/utils/ugsHumanizeTypeKey';
import { ugsProviderDisplayLabel } from '@/utils/ugsProviderDisplayLabel';
import {
	ArrowTrendingUpIcon,
	ChartBarSquareIcon,
	CheckCircleIcon,
	ChevronRightIcon,
	Cog6ToothIcon,
	QueueListIcon,
	ServerIcon,
	SignalIcon,
	Squares2X2Icon,
	XCircleIcon,
} from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { NavigationHandler } from '../types/navigation';
import {
	UGS_DASHBOARD_GUIDE_AUDIO_LS_KEY,
	UGS_DASHBOARD_GUIDE_ROOT_ID,
	UGS_DASHBOARD_GUIDE_STEP_DEFS,
	UGS_DASHBOARD_GUIDE_TOUR_FOLDER,
} from './ugsDashboardGuideConstants';

interface UGSDashboardProps {
	onNavigate?: NavigationHandler;
}

const ACTIVE_STATUSES = new Set([
	'pending',
	'processing',
	'queued',
	'retrying',
]);

const UGSDashboard: React.FC<UGSDashboardProps> = ({ onNavigate }) => {
	const { t } = useTranslation('ugsDashboard');
	const { t: tHub } = useTranslation('ugsHub');
	const theme = useDesktopShellTheme();
	const guideLabels = useMemo(() => guideTourLabelsFromI18n(t, 'guide'), [t]);
	const guideSteps = useBuiltGuideSteps(
		t,
		'guide.steps',
		UGS_DASHBOARD_GUIDE_STEP_DEFS
	);
	const [guideOpen, setGuideOpen] = useState(false);
	const openGuideTour = useCallback(() => setGuideOpen(true), []);
	useDesktopGuideTourOpener(openGuideTour);

	const {
		stats,
		tasks,
		providerHealth,
		isLoading,
		isFetching,
		isError,
		refresh,
		lastUpdated,
	} = useUgsDashboard({ pollingEnabled: true, limit: 40 });

	const metricsQuery = useQuery({
		queryKey: ['ugs', 'metrics'] as const,
		queryFn: fetchUgsMetrics,
		staleTime: 30_000,
		refetchInterval: 60_000,
	});

	const handleRefresh = useCallback(() => {
		void Promise.all([refresh(), metricsQuery.refetch()]);
	}, [metricsQuery, refresh]);

	const activeTasks = useMemo(
		() => tasks.filter((task) => ACTIVE_STATUSES.has(task.status)).slice(0, 8),
		[tasks]
	);

	const degradedProviders = providerHealth.filter(
		(p) => p.status !== 'healthy'
	);
	const metrics = metricsQuery.data;

	const statCards: Array<{
		key: string;
		value: string | number;
		icon: typeof SignalIcon;
		label: string;
		hint: string;
		accent?: 'default' | 'success' | 'warning' | 'danger';
	}> = [
		{
			key: 'active',
			value: stats?.active_tasks ?? 0,
			icon: SignalIcon,
			label: t('stats.active.label'),
			hint: t('stats.active.hint'),
			accent: (stats?.active_tasks ?? 0) > 0 ? 'warning' : 'default',
		},
		{
			key: 'completed',
			value: stats?.completed_today ?? 0,
			icon: CheckCircleIcon,
			label: t('stats.completedToday.label'),
			hint: t('stats.completedToday.hint'),
			accent: 'success',
		},
		{
			key: 'failed',
			value: stats?.failed_today ?? 0,
			icon: XCircleIcon,
			label: t('stats.failedToday.label'),
			hint: t('stats.failedToday.hint'),
			accent: (stats?.failed_today ?? 0) > 0 ? 'danger' : 'default',
		},
		{
			key: 'queue',
			value: stats?.queue_size ?? 0,
			icon: QueueListIcon,
			label: t('stats.queue.label'),
			hint: t('stats.queue.hint'),
			accent: (stats?.queue_size ?? 0) > 10 ? 'warning' : 'default',
		},
		{
			key: 'total',
			value: stats?.total_generations ?? 0,
			icon: ServerIcon,
			label: t('stats.total.label'),
			hint: t('stats.total.hint'),
		},
		{
			key: 'latency',
			value:
				stats?.avg_response_time != null
					? `${stats.avg_response_time.toFixed(1)} с`
					: '—',
			icon: ArrowTrendingUpIcon,
			label: t('stats.latency.label'),
			hint: t('stats.latency.hint'),
		},
	];

	if (metrics?.success_rate != null) {
		statCards.push({
			key: 'successRate',
			value: `${Math.round(metrics.success_rate * 100)}%`,
			icon: ChartBarSquareIcon,
			label: t('stats.successRate.label'),
			hint: t('stats.successRate.hint'),
			accent:
				metrics.success_rate >= 0.9
					? 'success'
					: metrics.success_rate < 0.7
						? 'danger'
						: 'warning',
		});
	}

	const shortcuts = [
		{
			page: 'ugs-hub' as const,
			icon: Squares2X2Icon,
			label: t('shortcuts.ugsHub.label'),
			description: t('shortcuts.ugsHub.description'),
		},
		{
			page: 'ugs-analytics' as const,
			icon: ChartBarSquareIcon,
			label: t('shortcuts.analytics.label'),
			description: t('shortcuts.analytics.description'),
		},
		{
			page: 'ugs-admin' as const,
			icon: Cog6ToothIcon,
			label: t('shortcuts.ugsAdmin.label'),
			description: t('shortcuts.ugsAdmin.description'),
		},
	];

	return (
		<UgsWorkspaceShell
			rootId={UGS_DASHBOARD_GUIDE_ROOT_ID}
			title={t('title')}
			subtitle={t('subtitle')}
			isFetching={isFetching || metricsQuery.isFetching}
			lastUpdated={lastUpdated}
			onRefresh={handleRefresh}
			headerActions={
				<button
					type="button"
					onClick={openGuideTour}
					className={cn(
						ugsHubHeaderBtnClasses(theme),
						'min-h-10 px-3',
						DESKTOP_CHROME_FOCUS_VISIBLE
					)}
				>
					{t('guide.badge')}
				</button>
			}
			data-testid="ugs-dashboard-root"
		>
			{isLoading ? <UgsWorkspaceLoading theme={theme} kpiCount={6} /> : null}

			{isError ? (
				<RetryBlock
					message={t('error')}
					onRetry={handleRefresh}
					retryLabel={t('retry')}
				/>
			) : null}

			{!isLoading && !isError ? (
				<>
					<section
						className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
						data-ugs-dashboard-guide="stats"
					>
						{statCards.map((card) => (
							<UgsMetricCard
								key={card.key}
								theme={theme}
								label={card.label}
								value={card.value}
								hint={card.hint}
								icon={card.icon}
								accent={card.accent}
							/>
						))}
					</section>

					<div className="grid min-w-0 gap-6 xl:grid-cols-2">
						<section
							className={cn(ugsHubPanelClasses(theme), 'p-4')}
							data-ugs-dashboard-guide="providers"
						>
							<UgsHubSectionHeading
								eyebrow="UGS"
								title={t('providers.title')}
								count={providerHealth.length}
							/>
							{degradedProviders.length > 0 ? (
								<div
									className={cn(
										'mb-3 flex flex-wrap items-center justify-between gap-2',
										UGS_WORKSPACE_SEMANTIC.warningBanner
									)}
								>
									<span>
										{t('providers.degraded', {
											count: degradedProviders.length,
										})}
									</span>
									<button
										type="button"
										onClick={() => onNavigate?.('ugs-admin')}
										className={cn(
											ugsHubHeaderBtnClasses(theme),
											'px-2 py-1',
											DESKTOP_CHROME_FOCUS_VISIBLE
										)}
									>
										{t('providers.openAdmin')}
									</button>
								</div>
							) : (
								<p className={cn('mb-3 text-xs', ugsHubTextMuted(theme))}>
									{t('providers.healthy', {
										healthy: providerHealth.filter(
											(p) => p.status === 'healthy'
										).length,
										total: providerHealth.length,
									})}
								</p>
							)}
							<ul className="space-y-2">
								{providerHealth.map((provider) => (
									<li
										key={provider.provider_name}
										className={ugsHubInsetRowClasses(theme)}
									>
										<div className="min-w-0">
											<p
												className={cn(
													'truncate text-sm font-medium',
													ugsHubTextPrimary(theme)
												)}
											>
												{ugsProviderDisplayLabel(
													provider.display_label,
													undefined,
													provider.provider_name
												)}
											</p>
											<p className={cn('text-xs', ugsHubTextMuted(theme))}>
												{provider.response_time != null
													? `${provider.response_time.toFixed(0)} ms`
													: (provider.error ?? '—')}
											</p>
										</div>
										<span
											className={cn(
												'h-2.5 w-2.5 shrink-0 rounded-full',
												provider.status === 'healthy' &&
													UGS_WORKSPACE_SEMANTIC.successDot,
												provider.status === 'degraded' &&
													UGS_WORKSPACE_SEMANTIC.warningDot,
												provider.status !== 'healthy' &&
													provider.status !== 'degraded' &&
													UGS_WORKSPACE_SEMANTIC.dangerDot
											)}
											aria-hidden
										/>
									</li>
								))}
							</ul>
						</section>

						<section
							className={cn(ugsHubPanelClasses(theme), 'p-4')}
							data-ugs-dashboard-guide="tasks"
						>
							<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
								<UgsHubSectionHeading
									eyebrow="UGS"
									title={t('activeTasks.title')}
									count={activeTasks.length}
								/>
								<button
									type="button"
									onClick={() => onNavigate?.('ugs-hub')}
									className={cn(
										ugsHubHeaderBtnClasses(theme),
										'px-3 py-1.5 text-xs',
										DESKTOP_CHROME_FOCUS_VISIBLE
									)}
								>
									{t('activeTasks.openHub')}
								</button>
							</div>
							{activeTasks.length === 0 ? (
								<p className={cn('text-sm', ugsHubTextSecondary(theme))}>
									{t('activeTasks.empty')}
								</p>
							) : (
								<ul className="space-y-2">
									{activeTasks.map((task) => (
										<li key={task.id} className={ugsHubInsetRowClasses(theme)}>
											<div className="min-w-0 flex-1">
												<p
													className={cn(
														'truncate text-sm',
														ugsHubTextPrimary(theme)
													)}
												>
													{humanizeUgsTypeKey(task.type_key)}
												</p>
												<p className={cn('text-xs', ugsHubTextMuted(theme))}>
													{task.id.slice(0, 8)}…
												</p>
											</div>
											<span
												className={cn(
													'rounded-full border px-2 py-0.5 text-[11px] font-medium',
													ugsHubStatusBadgeClasses(theme, task.status)
												)}
											>
												{ugsHubStatusLabel(tHub, task.status)}
											</span>
										</li>
									))}
								</ul>
							)}
						</section>
					</div>

					{metrics?.popular_types && metrics.popular_types.length > 0 ? (
						<section className={cn(ugsHubPanelClasses(theme), 'p-4')}>
							<UgsHubSectionHeading
								eyebrow="UGS"
								title={t('popularTypes.title')}
								count={metrics.popular_types.length}
							/>
							<div className="mt-3 flex flex-wrap gap-2">
								{metrics.popular_types.slice(0, 8).map((item) => (
									<span
										key={item.type_key}
										className={cn(
											'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs',
											ugsHubInsetRowClasses(theme)
										)}
									>
										<span className={ugsHubTextPrimary(theme)}>
											{item.display_name || humanizeUgsTypeKey(item.type_key)}
										</span>
										<span
											className={cn('tabular-nums', ugsHubTextMuted(theme))}
										>
											{item.count}
										</span>
									</span>
								))}
							</div>
						</section>
					) : null}

					<section data-ugs-dashboard-guide="shortcuts">
						<UgsHubSectionHeading eyebrow="UGS" title={t('shortcuts.title')} />
						<ul className="mt-3 grid gap-3 sm:grid-cols-2">
							{shortcuts.map(({ page, icon: Icon, label, description }) => (
								<li key={page}>
									<button
										type="button"
										onClick={() => onNavigate?.(page)}
										className={cn(
											ugsWorkspaceShortcutTileClass,
											DESKTOP_CHROME_FOCUS_VISIBLE
										)}
									>
										<span className={ugsHubIconTileClasses(theme)}>
											<Icon
												className="h-5 w-5"
												strokeWidth={DESKTOP_LUCIDE.stroke}
												aria-hidden
											/>
										</span>
										<span className="min-w-0 flex-1">
											<span
												className={cn(
													'block font-medium',
													ugsHubTextPrimary(theme)
												)}
											>
												{label}
											</span>
											<span
												className={cn(
													DESKTOP_TYPOGRAPHY.meta,
													'mt-0.5 block',
													ugsHubTextSecondary(theme)
												)}
											>
												{description}
											</span>
										</span>
										<ChevronRightIcon
											className={cn(
												'mt-0.5 h-4 w-4 shrink-0 opacity-60',
												ugsHubTextMuted(theme)
											)}
											strokeWidth={DESKTOP_LUCIDE.stroke}
											aria-hidden
										/>
									</button>
								</li>
							))}
						</ul>
					</section>
				</>
			) : null}

			<SpotlightGuideModal
				open={guideOpen}
				onClose={() => setGuideOpen(false)}
				rootId={UGS_DASHBOARD_GUIDE_ROOT_ID}
				steps={guideSteps}
				audioLocalStorageKey={UGS_DASHBOARD_GUIDE_AUDIO_LS_KEY}
				tourAudioFolder={UGS_DASHBOARD_GUIDE_TOUR_FOLDER}
				labels={guideLabels}
				dialogTitleId="ugs-dashboard-guide-title"
			/>
		</UgsWorkspaceShell>
	);
};

export default UGSDashboard;
