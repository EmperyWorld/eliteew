/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin Workers Celery tab — nodes, queues, depths, rate limits, live task tables.
 *
 * Invariants:
 * - Detail-skipped inspect phases surface as honest status, not empty-as-healthy.
 *
 * Related:
 * - `pages/Admin/workers/WorkersAdminSection.tsx`
 */

import type * as React from 'react';
import type { TFunction } from 'i18next';
import { DESKTOP_SURFACE } from '../../Desktop/constants';
import type { WorkersOpsSnapshot } from './workersOpsApi';
import { WorkersTaskTable } from './WorkersTaskTable';

const PANEL = `${DESKTOP_SURFACE.radius} ${DESKTOP_SURFACE.border} ${DESKTOP_SURFACE.spacingLg} bg-white/[0.03]`;

export function WorkersCeleryPanel({
	snap,
	t,
}: {
	snap: WorkersOpsSnapshot | null;
	t: TFunction;
}): React.ReactElement {
	const skipped = snap?.celery.inspect_phases?.detail_skipped ?? [];

	return (
		<div className="space-y-6">
			{snap?.celery.error ? (
				<p className={`${PANEL} p-3 text-sm text-amber-200`} role="status">
					{t('adminWorkers.inspectError', { error: snap.celery.error })}
				</p>
			) : null}
			{skipped.length > 0 ? (
				<p className="text-xs text-slate-500" role="status">
					{t('adminWorkers.detailSkipped', { list: skipped.join(', ') })}
				</p>
			) : null}
			<section>
				<h3 className="mb-2 text-sm font-semibold text-white">
					{t('adminWorkers.celeryWorkers')}
				</h3>
				<ul className="space-y-1 font-mono text-xs text-slate-300">
					{(snap?.celery.workers_online ?? []).map((w) => (
						<li key={w}>{w}</li>
					))}
					{!snap?.celery.workers_online.length ? (
						<li className="text-slate-500">{t('adminWorkers.empty')}</li>
					) : null}
				</ul>
			</section>
			<section>
				<h3 className="mb-2 text-sm font-semibold text-white">
					{t('adminWorkers.celeryQueues')}
				</h3>
				<ul className="space-y-1 font-mono text-xs text-slate-300">
					{(snap?.celery.queues ?? []).map((q) => (
						<li key={q.name}>
							{q.name} → {q.routing_key}
						</li>
					))}
				</ul>
			</section>
			<section>
				<h3 className="mb-2 text-sm font-semibold text-white">
					{t('adminWorkers.queueDepths')}
				</h3>
				{snap?.celery?.queue_depths.status === 'degraded' ? (
					<p className="text-sm text-amber-300" role="status">
						{t('adminWorkers.queueDepthsDegraded', {
							error: snap?.celery?.queue_depths.error ?? '—',
						})}
					</p>
				) : null}
				{snap?.celery?.queue_depths.status === 'ok' ? (
					<div className="overflow-x-auto">
						<table className="w-full min-w-[20rem] border-collapse text-left text-sm text-slate-200">
							<thead>
								<tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
									<th className="px-2 py-2">
										{t('adminWorkers.queueDepthColQueue')}
									</th>
									<th className="px-2 py-2">
										{t('adminWorkers.queueDepthColDepth')}
									</th>
								</tr>
							</thead>
							<tbody>
								{Object.entries(snap?.celery?.queue_depths.depths ?? {})
									.sort(([a], [b]) => a.localeCompare(b))
									.map(([queue, depth]) => (
										<tr key={queue} className="border-b border-white/[0.06]">
											<td className="px-2 py-2 font-mono text-xs">{queue}</td>
											<td className="px-2 py-2 font-mono text-xs">{depth}</td>
										</tr>
									))}
							</tbody>
						</table>
					</div>
				) : null}
			</section>
			<section>
				<h3 className="mb-2 text-sm font-semibold text-white">
					{t('adminWorkers.rateLimitPolicy')}
				</h3>
				<div className={`${PANEL} p-4 text-sm text-slate-300`}>
					<p>
						{t('adminWorkers.rateLimitDefault', {
							limit: snap?.celery?.rate_limit_policy?.default_rate_limit ?? '—',
						})}
					</p>
					{(snap?.celery?.rate_limit_policy?.exempt_tasks.length ?? 0) > 0 ? (
						<ul className="mt-2 space-y-1 font-mono text-xs text-slate-400">
							{snap?.celery?.rate_limit_policy?.exempt_tasks.map((task) => (
								<li key={task}>{task}</li>
							))}
						</ul>
					) : (
						<p className="mt-1 text-xs text-slate-500">
							{t('adminWorkers.empty')}
						</p>
					)}
				</div>
			</section>
			<section>
				<h3 className="mb-2 text-sm font-semibold text-white">
					{t('adminWorkers.activeTasks')}
				</h3>
				<WorkersTaskTable
					rows={snap?.celery.active ?? []}
					empty={t('adminWorkers.empty')}
				/>
			</section>
			<section>
				<h3 className="mb-2 text-sm font-semibold text-white">
					{t('adminWorkers.reservedTasks')}
				</h3>
				<WorkersTaskTable
					rows={snap?.celery.reserved ?? []}
					empty={t('adminWorkers.empty')}
				/>
			</section>
			<section>
				<h3 className="mb-2 text-sm font-semibold text-white">
					{t('adminWorkers.scheduledTasks')}
				</h3>
				<WorkersTaskTable
					rows={snap?.celery.scheduled ?? []}
					empty={t('adminWorkers.empty')}
				/>
			</section>
		</div>
	);
}
