/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Platform Ops · Stack0 tab — runtime line, deploy id, in-process checks.
 *
 * Invariants:
 * - Honest degraded/unavailable; shows CLI hint for full line status.
 *
 * Related:
 * - `pages/Admin/platformOps/PlatformOpsAdminSection.tsx`
 */

import type * as React from 'react';
import type { TFunction } from 'i18next';
import { DESKTOP_SURFACE } from '../../Desktop/constants';
import type { PlatformOpsStack0Status } from './platformOpsApi';

const PANEL = `${DESKTOP_SURFACE.radius} ${DESKTOP_SURFACE.border} ${DESKTOP_SURFACE.spacingLg} bg-white/[0.03]`;

function overallClass(overall: string): string {
	if (overall === 'ok') return 'text-emerald-300';
	if (overall === 'degraded') return 'text-amber-300';
	return 'text-rose-300';
}

export function PlatformOpsStack0Panel({
	snap,
	t,
}: {
	snap: PlatformOpsStack0Status | null;
	t: TFunction;
}): React.ReactElement {
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
					<p className="mt-1 text-xs text-slate-500">
						{t('adminPlatformOps.probeScope', {
							scope: snap?.probe_scope ?? '—',
						})}
					</p>
				</div>
				<div className={`${PANEL} p-4`}>
					<p className="text-xs uppercase tracking-wide text-slate-400">
						{t('adminPlatformOps.kpiRuntimeLine')}
					</p>
					<p className="mt-1 text-2xl font-semibold text-white">
						{snap?.runtime_line ?? '—'}
					</p>
					<p className="mt-1 text-xs text-slate-400">
						{t('adminPlatformOps.lineSource', {
							source: snap?.runtime_line_source ?? '—',
						})}
					</p>
				</div>
				<div className={`${PANEL} p-4`}>
					<p className="text-xs uppercase tracking-wide text-slate-400">
						{t('adminPlatformOps.kpiDeployId')}
					</p>
					<p className="mt-1 break-all text-lg font-semibold text-white">
						{snap?.app_build_id ?? '—'}
					</p>
					<p className="mt-1 text-xs text-slate-400">
						{t('adminPlatformOps.appVersion', {
							version: snap?.app_version ?? '—',
						})}
					</p>
				</div>
				<div className={`${PANEL} p-4`}>
					<p className="text-xs uppercase tracking-wide text-slate-400">
						{t('adminPlatformOps.kpiProfile')}
					</p>
					<p className="mt-1 text-sm font-medium text-white">
						{snap?.install_profile ?? t('adminPlatformOps.notSet')}
					</p>
					<p className="mt-1 text-xs text-slate-400">
						{t('adminPlatformOps.edition', {
							edition: snap?.product_edition ?? t('adminPlatformOps.notSet'),
						})}
					</p>
				</div>
			</div>

			<div className={`${PANEL} p-4`}>
				<p className="text-xs uppercase tracking-wide text-slate-400">
					{t('adminPlatformOps.checks')}
				</p>
				<ul className="mt-3 space-y-2">
					{(snap?.checks ?? []).map((check) => (
						<li
							key={check.id}
							className="flex flex-wrap items-baseline gap-2 text-sm text-slate-200"
						>
							<span className="font-mono text-xs text-slate-400">
								{check.id}
							</span>
							<span className={overallClass(check.status)}>{check.status}</span>
							<span className="text-slate-400">{check.detail}</span>
						</li>
					))}
					{(snap?.checks?.length ?? 0) === 0 ? (
						<li className="text-sm text-slate-500">
							{t('adminPlatformOps.noChecks')}
						</li>
					) : null}
				</ul>
			</div>

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
