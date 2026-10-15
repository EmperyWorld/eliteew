/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Platform Ops · Egress tab — Podman egress monitor snapshot (read-only).
 *
 * Invariants:
 * - Shows unavailable honestly when status JSON is not mounted into the API.
 *
 * Related:
 * - `pages/Admin/platformOps/PlatformOpsAdminSection.tsx`
 */

import type * as React from 'react';
import type { TFunction } from 'i18next';
import { DESKTOP_SURFACE } from '../../Desktop/constants';
import type { PlatformOpsEgressStatus } from './platformOpsApi';

const PANEL = `${DESKTOP_SURFACE.radius} ${DESKTOP_SURFACE.border} ${DESKTOP_SURFACE.spacingLg} bg-white/[0.03]`;

function overallClass(overall: string): string {
	if (overall === 'ok') return 'text-emerald-300';
	if (overall === 'degraded') return 'text-amber-300';
	return 'text-rose-300';
}

export function PlatformOpsEgressPanel({
	snap,
	t,
}: {
	snap: PlatformOpsEgressStatus | null;
	t: TFunction;
}): React.ReactElement {
	const counts = snap?.mode_counts ?? {};
	const containers = snap?.containers ?? [];

	return (
		<div className="space-y-4">
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<div className={`${PANEL} p-4`}>
					<p className="text-xs uppercase tracking-wide text-slate-400">
						{t('adminPlatformOps.kpiOverall')}
					</p>
					<p
						className={`mt-1 text-2xl font-semibold ${overallClass(snap?.overall ?? '')}`}
					>
						{snap?.overall ?? '—'}
					</p>
				</div>
				<div className={`${PANEL} p-4`}>
					<p className="text-xs uppercase tracking-wide text-slate-400">
						{t('adminPlatformOps.kpiLock')}
					</p>
					<p className="mt-1 text-2xl font-semibold text-white">
						{counts.lock ?? 0}
					</p>
				</div>
				<div className={`${PANEL} p-4`}>
					<p className="text-xs uppercase tracking-wide text-slate-400">
						{t('adminPlatformOps.kpiAllowlist')}
					</p>
					<p className="mt-1 text-2xl font-semibold text-white">
						{counts.allowlist ?? 0}
					</p>
				</div>
				<div className={`${PANEL} p-4`}>
					<p className="text-xs uppercase tracking-wide text-slate-400">
						{t('adminPlatformOps.kpiWanOpen')}
					</p>
					<p className="mt-1 text-2xl font-semibold text-white">
						{counts.wan_open ?? 0}
					</p>
				</div>
			</div>

			{snap?.error ? (
				<p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
					{t('adminPlatformOps.egressUnavailable', { error: snap.error })}
				</p>
			) : null}

			<div className={`${PANEL} overflow-x-auto p-4`}>
				<p className="text-xs uppercase tracking-wide text-slate-400">
					{t('adminPlatformOps.containers')}
				</p>
				{containers.length === 0 ? (
					<p className="mt-3 text-sm text-slate-500">
						{t('adminPlatformOps.noContainers')}
					</p>
				) : (
					<table className="mt-3 w-full min-w-[32rem] text-left text-sm text-slate-200">
						<thead className="text-xs uppercase text-slate-500">
							<tr>
								<th className="pb-2 pr-3 font-medium">
									{t('adminPlatformOps.colName')}
								</th>
								<th className="pb-2 pr-3 font-medium">
									{t('adminPlatformOps.colMode')}
								</th>
								<th className="pb-2 pr-3 font-medium">
									{t('adminPlatformOps.colRunning')}
								</th>
								<th className="pb-2 font-medium">
									{t('adminPlatformOps.colIps')}
								</th>
							</tr>
						</thead>
						<tbody>
							{containers.map((row) => (
								<tr key={row.name} className="border-t border-white/5">
									<td className="py-2 pr-3 font-mono text-xs">{row.name}</td>
									<td className="py-2 pr-3">{row.mode}</td>
									<td className="py-2 pr-3">
										{row.running
											? t('adminPlatformOps.runningYes')
											: t('adminPlatformOps.runningNo')}
									</td>
									<td className="py-2 font-mono text-xs text-slate-400">
										{(row.ips ?? []).join(', ') || '—'}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>

			{snap?.updated_at ? (
				<p className="text-xs text-slate-500">
					{t('adminPlatformOps.updatedAt', { at: snap.updated_at })}
				</p>
			) : null}
			{snap?.status_path ? (
				<p className="font-mono text-xs text-slate-500">{snap.status_path}</p>
			) : null}
			{snap?.cli_hint ? (
				<p className="rounded-md border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs text-slate-300">
					{snap.cli_hint}
				</p>
			) : null}
			{(snap?.notes ?? []).map((note) => (
				<p key={note} className="text-xs text-slate-500">
					{note}
				</p>
			))}
		</div>
	);
}
