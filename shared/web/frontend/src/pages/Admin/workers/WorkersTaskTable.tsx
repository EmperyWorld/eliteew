/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact task table for Celery active / reserved / scheduled rows.
 *
 * Invariants:
 * - Empty state uses caller-provided copy (i18n).
 *
 * Related:
 * - `pages/Admin/workers/WorkersCeleryPanel.tsx`
 */

import type * as React from 'react';
import type { WorkersOpsTaskRow } from './workersOpsApi';

export function WorkersTaskTable({
	rows,
	empty,
}: {
	rows: WorkersOpsTaskRow[];
	empty: string;
}): React.ReactElement {
	if (!rows.length) {
		return <p className="text-sm text-slate-400">{empty}</p>;
	}
	return (
		<div className="overflow-x-auto">
			<table className="w-full min-w-[40rem] border-collapse text-left text-sm text-slate-200">
				<thead>
					<tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
						<th className="px-2 py-2">Worker</th>
						<th className="px-2 py-2">Task</th>
						<th className="px-2 py-2">Id</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr
							key={`${row.worker}-${row.id}-${row.name}`}
							className="border-b border-white/[0.06]"
						>
							<td className="px-2 py-2 font-mono text-xs">{row.worker}</td>
							<td className="px-2 py-2 font-mono text-xs">{row.name}</td>
							<td className="px-2 py-2 font-mono text-xs">{row.id || '—'}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
