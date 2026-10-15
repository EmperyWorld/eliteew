/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin Workers Overview tab — pool KPIs, inspect honesty, rate-limit summary.
 *
 * Invariants:
 * - Shows celery.error / inspect_timeout so false Offline is diagnosable.
 *
 * Related:
 * - `pages/Admin/workers/WorkersAdminSection.tsx`
 */

import type * as React from 'react';
import type { TFunction } from 'i18next';
import { DESKTOP_SURFACE } from '../../Desktop/constants';
import type { WorkersOpsSnapshot } from './workersOpsApi';
import { countOnlinePools } from './workersOpsApi';
import { onlineChipClass, onlineLabelKey } from './workersStatus';

const PANEL = `${DESKTOP_SURFACE.radius} ${DESKTOP_SURFACE.border} ${DESKTOP_SURFACE.spacingLg} bg-white/[0.03]`;

export function WorkersOverviewPanel({
	snap,
	t,
}: {
	snap: WorkersOpsSnapshot | null;
	t: TFunction;
}): React.ReactElement {
	const pools = snap?.expected_pools ?? [];
	const poolCounts = countOnlinePools(pools);
	const beatHealth = snap?.beat.health ?? {};
	const beatStale = Boolean(beatHealth.stale);
	const celeryError = snap?.celery.error ?? null;
	const phases = snap?.celery.inspect_phases;
	const depths = snap?.celery.queue_depths;
	const pendingTotal =
		depths?.status === 'ok'
			? Object.values(depths.depths).reduce((acc, n) => acc + n, 0)
			: null;

	return (
		<div className="space-y-4">
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<div className={`${PANEL} p-4`}>
					<p className="text-xs uppercase tracking-wide text-slate-400">
						{t('adminWorkers.kpiPools')}
					</p>
					<p className="mt-1 text-2xl font-semibold text-white">
						{poolCounts.online}/{poolCounts.total}
					</p>
					{poolCounts.unknown > 0 ? (
						<p className="mt-1 text-xs text-amber-300">
							{t('adminWorkers.kpiUnknown', { count: poolCounts.unknown })}
						</p>
					) : null}
				</div>
				<div className={`${PANEL} p-4`}>
					<p className="text-xs uppercase tracking-wide text-slate-400">
						{t('adminWorkers.kpiCelery')}
					</p>
					<p className="mt-1 text-2xl font-semibold text-white">
						{snap?.celery.status ?? '—'}
					</p>
					<p className="mt-1 text-xs text-slate-400">
						{t('adminWorkers.workersOnline', {
							count: snap?.celery.workers_online.length ?? 0,
						})}
					</p>
					{celeryError ? (
						<p className="mt-2 text-xs text-amber-300" role="status">
							{t('adminWorkers.inspectError', { error: celeryError })}
						</p>
					) : null}
					{phases?.essential_sec != null ? (
						<p className="mt-1 text-xs text-slate-500">
							{t('adminWorkers.inspectTiming', {
								essential: String(phases.essential_sec),
								detail:
									phases.detail_sec != null ? String(phases.detail_sec) : '—',
							})}
						</p>
					) : null}
				</div>
				<div className={`${PANEL} p-4`}>
					<p className="text-xs uppercase tracking-wide text-slate-400">
						{t('adminWorkers.kpiBeat')}
					</p>
					<p className="mt-1 text-2xl font-semibold text-white">
						{beatStale ? t('adminWorkers.beatStale') : t('adminWorkers.beatOk')}
					</p>
				</div>
				<div className={`${PANEL} p-4`}>
					<p className="text-xs uppercase tracking-wide text-slate-400">
						{t('adminWorkers.kpiQueuePending')}
					</p>
					<p className="mt-1 text-2xl font-semibold text-white">
						{pendingTotal == null ? '—' : pendingTotal}
					</p>
					{depths?.status === 'degraded' ? (
						<p className="mt-1 text-xs text-amber-300">
							{t('adminWorkers.queueDepthsDegraded', {
								error: depths.error ?? '—',
							})}
						</p>
					) : (
						<p className="mt-1 text-xs text-slate-400">
							{t('adminWorkers.kpiQueuePendingHint')}
						</p>
					)}
				</div>
			</div>

			<ul className="space-y-2">
				{pools.map((p) => (
					<li
						key={p.id}
						className={`${PANEL} flex flex-wrap items-center justify-between gap-2 px-4 py-3`}
					>
						<div className="min-w-0">
							<p className="font-medium text-white">{p.label}</p>
							<p className="font-mono text-xs text-slate-400">{p.container}</p>
							{(p.matched_workers?.length ?? 0) > 0 ? (
								<p className="mt-1 font-mono text-xs text-slate-500">
									{p.matched_workers?.join(', ')}
								</p>
							) : null}
							{p.online_reason ? (
								<p className="mt-0.5 text-xs text-slate-500">
									{t('adminWorkers.onlineReason', { reason: p.online_reason })}
								</p>
							) : null}
						</div>
						<span
							className={`rounded-full px-2 py-0.5 text-xs ${onlineChipClass(p.online)}`}
						>
							{t(onlineLabelKey(p.online))}
						</span>
					</li>
				))}
			</ul>

			<div className={`${PANEL} mt-4 p-4 text-sm text-slate-300`}>
				<p className="font-semibold text-white">
					{t('adminWorkers.rateLimitPolicy')}
				</p>
				<p className="mt-1">
					{t('adminWorkers.rateLimitDefault', {
						limit: snap?.celery?.rate_limit_policy?.default_rate_limit ?? '—',
					})}
				</p>
				{(snap?.celery?.rate_limit_policy?.exempt_tasks.length ?? 0) > 0 ? (
					<p className="mt-1 text-xs text-slate-400">
						{t('adminWorkers.rateLimitExemptCount', {
							count: snap?.celery?.rate_limit_policy?.exempt_tasks.length ?? 0,
						})}
					</p>
				) : null}
			</div>
		</div>
	);
}
