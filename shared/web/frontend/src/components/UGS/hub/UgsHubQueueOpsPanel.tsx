/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact UGS admin queue-snapshot panel (Postgres backlog, Redis leases, operator hints).
 * Kept for isolation tests / Admin surfaces — not mounted on Hub Overview.
 *
 * Invariants:
 * - Renders only for callers that already gate on UGS admin; does not expose secrets.
 * - User-visible copy avoids internal «queue-ops» jargon.
 *
 * Related:
 * - services/api/ugs/queueOps.ts
 * - documentation/platform/docker-re_doc/UGS-QUEUE-OPERATIONS-RUNBOOK.md
 */

import {
	ArrowPathIcon,
	ChevronDownIcon,
	ClockIcon,
	ExclamationTriangleIcon,
	QueueListIcon,
	ServerStackIcon,
} from '@heroicons/react/24/outline';
import type { FC } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useUgsQueueOpsSnapshot } from '../../../hooks/api/useUgsQueueOpsSnapshot';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '../../../pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_LUCIDE } from '../../../pages/Desktop/constants';
import type { UgsQueueOpsStaleHorizons } from '../../../services/api/ugs/queueOps';
import { UgsMetricCard } from '../workspace/UgsMetricCard';
import {
	UGS_INFO_BADGE,
	UGS_WORKSPACE_SEMANTIC,
	ugsQueueOpsDetailPanelClass,
	ugsQueueOpsStatusBadgeClass,
} from '../../../features/ugs/shared/ugsDesktopUi';
import { cn } from '../../../utils/cn';
import { useUgsHubShellTheme } from './ugsHubShellThemeContext';
import {
	ugsHubEyebrowClasses,
	ugsHubHeaderBtnClasses,
	ugsHubIconTileClasses,
	ugsHubPanelClasses,
	ugsHubTextMuted,
	ugsHubTextPrimary,
} from './ugsHubSharedUi';

function hintTone(level: string): string {
	if (level === 'warning') {
		return cn(
			UGS_WORKSPACE_SEMANTIC.warningBanner,
			'rounded-lg px-3 py-2 text-xs leading-relaxed'
		);
	}
	return cn(
		ugsQueueOpsDetailPanelClass,
		'text-xs leading-relaxed text-(--desktop-text-secondary)'
	);
}

function readStaleHorizons(raw: unknown): UgsQueueOpsStaleHorizons | null {
	if (!raw || typeof raw !== 'object') {
		return null;
	}
	return raw as UgsQueueOpsStaleHorizons;
}

function formatStaleHorizonMetric(value: unknown): string {
	return typeof value === 'number' && Number.isFinite(value)
		? String(value)
		: '—';
}

export interface UgsHubQueueOpsPanelProps {
	onOpenAdmin?: () => void;
	/** True when Hub proactively prefetches task pages due to queue backlog. */
	tasksPrefetchActive?: boolean;
}

export const UgsHubQueueOpsPanel: FC<UgsHubQueueOpsPanelProps> = ({
	onOpenAdmin,
	tasksPrefetchActive = false,
}) => {
	const { t } = useTranslation('ugsHub');
	const theme = useUgsHubShellTheme();
	const [expanded, setExpanded] = useState(false);
	const btn = ugsHubHeaderBtnClasses(theme);

	const query = useUgsQueueOpsSnapshot();

	const snapshot = query.data;
	const postgres = snapshot?.postgres;
	const leases = snapshot?.redis?.ugs_worker_leases;
	const stale = postgres?.stale_candidates;
	const staleHorizons = readStaleHorizons(
		snapshot?.worker_tuning?.stale_horizons
	);
	const logGrep = snapshot?.log_grep ?? [];
	const hints = snapshot?.hints ?? [];
	const warningHints = hints.filter((h) => h.level === 'warning');
	const operatorSlo = snapshot?.operator_slo;
	const oldestAgeSec = operatorSlo?.pending_oldest_age_seconds;
	const failedShare = operatorSlo?.failed_share;

	const formatAge = (seconds: number | null | undefined): string => {
		if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '—';
		if (seconds < 60) return `${Math.round(seconds)}s`;
		if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
		return `${(seconds / 3600).toFixed(1)}h`;
	};

	const formatFailShare = (share: number | null | undefined): string => {
		if (typeof share !== 'number' || !Number.isFinite(share)) return '—';
		return `${(share * 100).toFixed(1)}%`;
	};

	return (
		<section
			className={cn(ugsHubPanelClasses(theme, 'min-w-0 p-4'))}
			data-testid="ugs-hub-queue-ops"
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex min-w-0 items-start gap-3">
					<div className={ugsHubIconTileClasses(theme)}>
						<ServerStackIcon
							className="h-5 w-5"
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					</div>
					<div className="min-w-0 space-y-1">
						<p className={ugsHubEyebrowClasses(theme)}>
							{t('queueOps.eyebrow')}
						</p>
						<div className="flex flex-wrap items-center gap-2">
							<h3
								className={cn(
									'text-base font-semibold',
									ugsHubTextPrimary(theme)
								)}
							>
								{t('queueOps.title')}
							</h3>
							{snapshot ? (
								<span className={ugsQueueOpsStatusBadgeClass(snapshot.status)}>
									{snapshot.status}
								</span>
							) : null}
							{warningHints.length > 0 ? (
								<span className={UGS_WORKSPACE_SEMANTIC.warningBadge}>
									{t('queueOps.warningsCount', {
										count: warningHints.length,
									})}
								</span>
							) : null}
							{tasksPrefetchActive ? (
								<span
									className={UGS_INFO_BADGE}
									data-testid="ugs-hub-queue-ops-prefetch-active"
								>
									{t('queueOps.prefetchActive')}
								</span>
							) : null}
						</div>
						<p className={cn('text-xs', ugsHubTextMuted(theme))}>
							{query.isLoading
								? t('queueOps.loading')
								: query.isError
									? t('queueOps.loadError')
									: snapshot?.timestamp
										? t('queueOps.updatedAt', {
												time: new Date(snapshot.timestamp).toLocaleString(),
											})
										: '—'}
						</p>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<button
						type="button"
						onClick={() => void query.refetch()}
						disabled={query.isFetching}
						className={cn(
							btn,
							'px-2.5 py-1 text-xs disabled:opacity-50',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
					>
						<ArrowPathIcon
							className={cn('h-3.5 w-3.5', query.isFetching && 'animate-spin')}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
						{t('queueOps.refresh')}
					</button>
					{onOpenAdmin ? (
						<button
							type="button"
							onClick={onOpenAdmin}
							className={cn(
								btn,
								'px-2.5 py-1 text-xs',
								DESKTOP_CHROME_FOCUS_VISIBLE
							)}
						>
							{t('queueOps.admin')}
						</button>
					) : null}
					<button
						type="button"
						onClick={() => setExpanded((v) => !v)}
						className={cn(
							btn,
							'px-2.5 py-1 text-xs',
							DESKTOP_CHROME_FOCUS_VISIBLE
						)}
						aria-expanded={expanded}
					>
						{expanded ? t('queueOps.collapse') : t('queueOps.expand')}
						<ChevronDownIcon
							className={cn('h-3.5 w-3.5 transition', expanded && 'rotate-180')}
							strokeWidth={DESKTOP_LUCIDE.stroke}
							aria-hidden
						/>
					</button>
				</div>
			</div>

			{snapshot ? (
				<div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
					<UgsMetricCard
						theme={theme}
						label={t('queueOps.metricQueued')}
						value={postgres?.total_queued ?? '—'}
						icon={QueueListIcon}
						accent={
							(postgres?.total_queued ?? 0) > 10
								? 'warning'
								: (postgres?.total_queued ?? 0) > 0
									? 'default'
									: 'success'
						}
						className="p-3"
					/>
					<UgsMetricCard
						theme={theme}
						label={t('queueOps.metricQueueAge')}
						value={formatAge(oldestAgeSec)}
						icon={ClockIcon}
						accent={
							typeof oldestAgeSec === 'number' && oldestAgeSec >= 1800
								? 'danger'
								: typeof oldestAgeSec === 'number' && oldestAgeSec >= 300
									? 'warning'
									: 'default'
						}
						className="p-3"
					/>
					<UgsMetricCard
						theme={theme}
						label={t('queueOps.metricFailShare')}
						value={formatFailShare(failedShare)}
						icon={ExclamationTriangleIcon}
						accent={
							typeof failedShare === 'number' && failedShare >= 0.35
								? 'danger'
								: typeof failedShare === 'number' && failedShare >= 0.15
									? 'warning'
									: 'default'
						}
						className="p-3"
					/>
					<UgsMetricCard
						theme={theme}
						label={t('queueOps.metricLease')}
						value={
							leases?.available === false
								? t('queueOps.metricLeaseFallback')
								: (leases?.active_leases ?? '—')
						}
						icon={ServerStackIcon}
						accent={leases?.available === false ? 'warning' : 'default'}
						className="p-3"
					/>
					<UgsMetricCard
						theme={theme}
						label={t('queueOps.metricStale')}
						value={stale?.total ?? '—'}
						icon={ClockIcon}
						accent={
							(stale?.total ?? 0) > 0
								? (stale?.total ?? 0) > 5
									? 'danger'
									: 'warning'
								: 'success'
						}
						className="p-3"
					/>
					<UgsMetricCard
						theme={theme}
						label={t('queueOps.metricDlq')}
						value={postgres?.dlq_finalized_failed_24h ?? '—'}
						icon={ExclamationTriangleIcon}
						accent={
							(postgres?.dlq_finalized_failed_24h ?? 0) > 0
								? 'danger'
								: 'default'
						}
						className="p-3"
					/>
				</div>
			) : null}

			{expanded && staleHorizons ? (
				<div
					className={cn('mt-4', ugsQueueOpsDetailPanelClass)}
					data-testid="ugs-hub-queue-ops-stale-horizons"
				>
					<p
						className={cn(
							'mb-2 text-[10px] font-semibold uppercase tracking-wide',
							ugsHubTextMuted(theme)
						)}
					>
						{t('queueOps.staleHorizonsTitle')}
					</p>
					<dl
						className={cn(
							'grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3',
							ugsHubTextMuted(theme)
						)}
					>
						<div>
							<dt>Pending orphan</dt>
							<dd className={cn('tabular-nums', ugsHubTextPrimary(theme))}>
								{formatStaleHorizonMetric(staleHorizons.pending_orphan_minutes)}{' '}
								min
							</dd>
						</div>
						<div>
							<dt>Processing default</dt>
							<dd className={cn('tabular-nums', ugsHubTextPrimary(theme))}>
								{formatStaleHorizonMetric(
									staleHorizons.processing_hours_default
								)}{' '}
								h
							</dd>
						</div>
						<div>
							<dt>Processing music</dt>
							<dd className={cn('tabular-nums', ugsHubTextPrimary(theme))}>
								{formatStaleHorizonMetric(staleHorizons.processing_hours_music)}{' '}
								h
							</dd>
						</div>
						<div>
							<dt>Processing image</dt>
							<dd className={cn('tabular-nums', ugsHubTextPrimary(theme))}>
								{formatStaleHorizonMetric(staleHorizons.processing_hours_image)}{' '}
								h
							</dd>
						</div>
						<div>
							<dt>Estimated ×</dt>
							<dd className={cn('tabular-nums', ugsHubTextPrimary(theme))}>
								{formatStaleHorizonMetric(
									staleHorizons.processing_estimated_multiplier
								)}
							</dd>
						</div>
					</dl>
				</div>
			) : null}

			{expanded && logGrep.length > 0 ? (
				<div className={cn('mt-4', ugsQueueOpsDetailPanelClass)}>
					<p
						className={cn(
							'mb-2 text-[10px] font-semibold uppercase tracking-wide',
							ugsHubTextMuted(theme)
						)}
					>
						{t('queueOps.logGrepTitle')}
					</p>
					<ul
						className={cn(
							'space-y-1 font-mono text-[11px]',
							ugsHubTextMuted(theme)
						)}
					>
						{logGrep.map((line) => (
							<li key={line} className="truncate" title={line}>
								{line}
							</li>
						))}
					</ul>
					<p className={cn('mt-2 text-[11px]', ugsHubTextMuted(theme))}>
						{t('queueOps.runbookCanon')}
					</p>
				</div>
			) : null}

			{expanded && hints.length > 0 ? (
				<ul className="mt-4 space-y-2">
					{hints.map((hint) => (
						<li
							key={hint.code}
							className={cn(
								'rounded-lg px-3 py-2 text-xs leading-relaxed',
								hintTone(hint.level)
							)}
						>
							<span className="font-mono text-[10px] uppercase opacity-70">
								{hint.code}
							</span>
							<p className="mt-0.5">{hint.message}</p>
						</li>
					))}
				</ul>
			) : null}

			{expanded && hints.length === 0 && snapshot ? (
				<p className={cn('mt-4 text-xs', ugsHubTextMuted(theme))}>
					{t('queueOps.noWarnings')}
				</p>
			) : null}
		</section>
	);
};
