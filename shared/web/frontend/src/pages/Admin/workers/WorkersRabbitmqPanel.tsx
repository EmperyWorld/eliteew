/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin Workers RabbitMQ tab — structured UGS queue-ops plane (not raw-only dump).
 *
 * Invariants:
 * - Prefer key summary fields; full JSON remains for deep debug.
 *
 * Related:
 * - `pages/Admin/workers/WorkersAdminSection.tsx`
 */

import type * as React from 'react';
import type { TFunction } from 'i18next';
import { DESKTOP_SURFACE } from '../../Desktop/constants';
import type { WorkersOpsSnapshot } from './workersOpsApi';

const PANEL = `${DESKTOP_SURFACE.radius} ${DESKTOP_SURFACE.border} ${DESKTOP_SURFACE.spacingLg} bg-white/[0.03]`;

function asRecord(value: unknown): Record<string, unknown> | null {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return null;
}

export function WorkersRabbitmqPanel({
	snap,
	t,
}: {
	snap: WorkersOpsSnapshot | null;
	t: TFunction;
}): React.ReactElement {
	const plane = asRecord(snap?.rabbitmq) ?? {};
	const rabbit = asRecord(plane.rabbitmq);
	const leases = asRecord(plane.redis_leases);
	const status = String(plane.status ?? rabbit?.ok ?? '—');

	return (
		<div className="space-y-3">
			<p className="text-sm text-slate-400">{t('adminWorkers.rmqIntro')}</p>
			<div className={`${PANEL} grid gap-3 p-4 sm:grid-cols-3`}>
				<div>
					<p className="text-xs uppercase tracking-wide text-slate-400">
						{t('adminWorkers.rmqStatus')}
					</p>
					<p className="mt-1 font-mono text-sm text-white">{status}</p>
				</div>
				<div>
					<p className="text-xs uppercase tracking-wide text-slate-400">
						{t('adminWorkers.rmqLeases')}
					</p>
					<p className="mt-1 font-mono text-sm text-white">
						{leases?.active_count != null ? String(leases.active_count) : '—'}
					</p>
				</div>
				<div>
					<p className="text-xs uppercase tracking-wide text-slate-400">
						{t('adminWorkers.rmqOk')}
					</p>
					<p className="mt-1 font-mono text-sm text-white">
						{rabbit?.ok == null ? '—' : String(Boolean(rabbit.ok))}
					</p>
				</div>
			</div>
			<details className={`${PANEL} p-4`}>
				<summary className="cursor-pointer text-sm text-slate-300">
					{t('adminWorkers.rmqRawJson')}
				</summary>
				<pre className="mt-3 max-h-[28rem] overflow-auto font-mono text-xs text-slate-200">
					{JSON.stringify(snap?.rabbitmq ?? {}, null, 2)}
				</pre>
			</details>
		</div>
	);
}
