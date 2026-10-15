/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin Workers Beat tab — health slice + static beat_schedule catalog.
 *
 * Invariants:
 * - — (нет)
 *
 * Related:
 * - `pages/Admin/workers/WorkersAdminSection.tsx`
 */

import type * as React from 'react';
import type { TFunction } from 'i18next';
import { DESKTOP_SURFACE } from '../../Desktop/constants';
import type { WorkersOpsSnapshot } from './workersOpsApi';

const PANEL = `${DESKTOP_SURFACE.radius} ${DESKTOP_SURFACE.border} ${DESKTOP_SURFACE.spacingLg} bg-white/[0.03]`;

export function WorkersBeatPanel({
	snap,
	t,
}: {
	snap: WorkersOpsSnapshot | null;
	t: TFunction;
}): React.ReactElement {
	const beatHealth = snap?.beat.health ?? {};
	const beatStale = Boolean(beatHealth.stale);

	return (
		<div className="space-y-4">
			<div className={`${PANEL} p-4 text-sm text-slate-300`}>
				<p>
					{t('adminWorkers.beatStatus')}:{' '}
					<span className="text-white">{String(beatHealth.status ?? '—')}</span>
					{beatStale ? (
						<span className="ml-2 text-amber-300">
							({t('adminWorkers.beatStale')})
						</span>
					) : null}
				</p>
				{beatHealth.last_success_unix != null ? (
					<p className="mt-1 text-xs text-slate-400">
						{t('adminWorkers.beatLastSuccess')}:{' '}
						{String(beatHealth.last_success_unix)}
					</p>
				) : null}
			</div>
			<div className="overflow-x-auto">
				<table className="w-full min-w-[40rem] border-collapse text-left text-sm">
					<thead>
						<tr className="border-b border-white/10 text-xs uppercase text-slate-400">
							<th className="px-2 py-2">Name</th>
							<th className="px-2 py-2">Task</th>
							<th className="px-2 py-2">Schedule</th>
						</tr>
					</thead>
					<tbody>
						{(snap?.beat.schedule ?? []).map((row) => (
							<tr
								key={row.name}
								className="border-b border-white/[0.06] text-slate-200"
							>
								<td className="px-2 py-2 font-mono text-xs">{row.name}</td>
								<td className="px-2 py-2 font-mono text-xs">{row.task}</td>
								<td className="px-2 py-2 text-xs">{row.schedule}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
