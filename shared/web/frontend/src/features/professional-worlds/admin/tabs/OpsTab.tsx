/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Professional Worlds admin Ops tab — health probes and per-vertical 24h usage (New World atoms).
 *
 * Invariants:
 * - Read-only metrics; probe refresh is explicit (60s client cache).
 * - Does not import adminUiShared (Wave 3 pilot tab).
 *
 * Related:
 * - src/features/professional-worlds/admin/api.ts
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import {
	AdminButton,
	AdminDataTable,
	AdminStatusBanner,
	type AdminDataTableColumn,
} from '@/pages/Admin/ui';

import { loadProfessionalWorldsOpsMetrics } from '../api';
import type { ProfessionalWorldsOpsMetrics } from '../types';

const CACHE_MS = 60_000;

type ProbeRow = NonNullable<ProfessionalWorldsOpsMetrics['probes']>[number];
type VerticalRow = NonNullable<
	ProfessionalWorldsOpsMetrics['by_vertical']
>[number];

export function OpsTab() {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const [metrics, setMetrics] = useState<ProfessionalWorldsOpsMetrics | null>(
		null
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const lastLoadedAt = useRef(0);

	const refresh = useCallback(
		async (force = false) => {
			const now = Date.now();
			if (
				!force &&
				metrics &&
				lastLoadedAt.current > 0 &&
				now - lastLoadedAt.current < CACHE_MS
			) {
				return;
			}
			setLoading(true);
			setError(null);
			try {
				const payload = await loadProfessionalWorldsOpsMetrics();
				setMetrics(payload);
				lastLoadedAt.current = Date.now();
			} catch (err) {
				setError(
					err instanceof Error ? err.message : t('admin.errors.operationFailed')
				);
			} finally {
				setLoading(false);
			}
		},
		[metrics, t]
	);

	useEffect(() => {
		void refresh(true);
	}, [refresh]);

	const probeColumns = useMemo<AdminDataTableColumn<ProbeRow>[]>(
		() => [
			{
				id: 'id',
				header: t('admin.ops.colProbe'),
				cell: (row) => (
					<span className="font-mono text-violet-200">{row.id}</span>
				),
			},
			{
				id: 'status',
				header: t('admin.ops.colStatus'),
				cell: (row) => (
					<span className={row.ok ? 'text-emerald-300' : 'text-red-300'}>
						{row.ok ? t('admin.ops.probeOk') : t('admin.ops.probeFail')}
					</span>
				),
			},
			{
				id: 'latency',
				header: t('admin.ops.colLatency'),
				cell: (row) => `${row.latency_ms} ms`,
			},
			{
				id: 'message',
				header: t('admin.ops.colMessage'),
				cell: (row) => row.message,
			},
		],
		[t]
	);

	const verticalColumns = useMemo<AdminDataTableColumn<VerticalRow>[]>(
		() => [
			{
				id: 'vertical',
				header: t('admin.ops.colVertical'),
				cell: (row) => (
					<span className="font-mono text-violet-200">
						{String(row.vertical_slug)}
					</span>
				),
			},
			{
				id: 'runs',
				header: t('admin.ops.colRuns'),
				cell: (row) => String(row.runs_24h),
			},
			{
				id: 'failed',
				header: t('admin.ops.colFailed'),
				cell: (row) => String(row.failed_24h),
			},
		],
		[t]
	);

	const kpiCards: [string, string][] = [
		[t('admin.ops.runs24h'), String(metrics?.runtime?.playbook_runs_24h ?? 0)],
		[
			t('admin.ops.failed24h'),
			String(
				metrics?.runtime?.failed_playbook_runs_24h ??
					metrics?.runtime?.playbook_runs_failed_24h ??
					0
			),
		],
		[
			t('admin.ops.mediaErrors24h'),
			String(metrics?.runtime?.media_job_errors_24h ?? 0),
		],
		[
			t('admin.ops.apiErrorRate24h'),
			`${metrics?.runtime?.api_error_rate_24h?.toFixed(1) ?? '0.0'}%`,
		],
		[t('admin.ops.artifacts24h'), String(metrics?.runtime?.artifacts_24h ?? 0)],
		[
			t('admin.ops.credits24h'),
			metrics?.runtime?.credits_used_24h?.toFixed(1) ?? '0',
		],
	];

	return (
		<div className="grid gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="text-sm text-[var(--admin-ui-fg-muted)]">
					{t('admin.ops.hint')}
				</p>
				<AdminButton
					variant="secondary"
					disabled={loading}
					onClick={() => void refresh(true)}
				>
					{loading ? t('admin.ops.runningProbes') : t('admin.ops.runProbes')}
				</AdminButton>
			</div>

			{error ? (
				<AdminStatusBanner tone="danger">{error}</AdminStatusBanner>
			) : null}

			<section className="space-y-2 rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-4">
				<h3 className="text-sm font-semibold text-[var(--admin-ui-fg)]">
					{t('admin.ops.probesTitle')}
				</h3>
				{(metrics?.probes ?? []).length ? (
					<AdminDataTable
						columns={probeColumns}
						rows={metrics?.probes ?? []}
						rowKey={(row) => row.id}
					/>
				) : (
					<p className="text-sm text-[var(--admin-ui-fg-muted)]">
						{loading ? t('admin.status.loading') : t('admin.ops.noProbes')}
					</p>
				)}
			</section>

			<div className="grid gap-4 md:grid-cols-4">
				{kpiCards.map(([label, value]) => (
					<section
						key={label}
						className="rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-4"
					>
						<p className="text-xs text-[var(--admin-ui-fg-muted)]">{label}</p>
						<strong className="text-3xl text-[var(--admin-ui-fg)]">
							{value}
						</strong>
					</section>
				))}
			</div>

			<section className="space-y-2 rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)] p-4">
				<h3 className="text-sm font-semibold text-[var(--admin-ui-fg)]">
					{t('admin.ops.byVerticalTitle')}
				</h3>
				{(metrics?.by_vertical ?? []).length ? (
					<AdminDataTable
						columns={verticalColumns}
						rows={metrics?.by_vertical ?? []}
						rowKey={(row) => String(row.vertical_slug)}
					/>
				) : (
					<p className="text-sm text-[var(--admin-ui-fg-muted)]">
						{t('admin.ops.noVerticalUsage')}
					</p>
				)}
			</section>
		</div>
	);
}
