/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Operator debug tab — recent companion task runs across all principals (WF-6+ admin).
 *
 * Invariants:
 * - Read-only; uses admin JWT and ``GET /api/v1/ewa/admin/companion/task-runs``.
 *
 * Related:
 * - src/features/ewa/admin/EwaCompanionAdminPanel.tsx
 * - api/ewa_platform/gateways/routers/companion_admin.py
 */
import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ewaCompanionDegradeDebug } from '@/features/ewa/ewaCompanionDegradeDebug';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import {
	classifyEwaCompanionAdminError,
	type EwaCompanionAdminTaskRun,
	fetchEwaCompanionAdminTaskRunDetail,
	fetchEwaCompanionAdminTaskRuns,
	type EwaCompanionAdminErrorCode,
} from './ewaCompanionAdminApi';

const STATUS_OPTIONS = [
	'',
	'pending',
	'running',
	'awaiting_confirmation',
	'completed',
	'failed',
	'cancelled',
] as const;
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);
const TASK_RUNS_POLL_MS = 15000;

function useAdminErrorMessage(error: unknown): string | null {
	const { t } = useTranslation('desktopUi');
	if (!error) {
		return null;
	}
	const code: EwaCompanionAdminErrorCode =
		classifyEwaCompanionAdminError(error);
	const keyMap: Record<EwaCompanionAdminErrorCode, string> = {
		admin_disabled: 'ewaCompanionAdmin.errorAdminDisabled',
		write_disabled: 'ewaCompanionAdmin.errorWriteDisabled',
		forbidden: 'ewaCompanionAdmin.errorForbidden',
		load_failed: 'ewaCompanionAdmin.errorLoadFailed',
	};
	return t(keyMap[code]);
}

function statusBadgeClass(status: string): string {
	switch (status) {
		case 'running':
		case 'pending':
			return 'bg-sky-500/15 text-sky-200';
		case 'completed':
			return 'bg-emerald-500/15 text-emerald-200';
		case 'failed':
			return 'bg-red-500/15 text-red-200';
		case 'awaiting_confirmation':
			return 'bg-amber-500/15 text-amber-100';
		default:
			return 'bg-[rgb(var(--desktop-fg-primary-rgb)/0.12)] text-(--desktop-text-secondary)';
	}
}

function formatTs(value: string | null | undefined): string {
	if (!value) {
		return '—';
	}
	try {
		return new Date(value).toLocaleString();
	} catch (err) {
		ewaCompanionDegradeDebug(
			'companion_admin_task_run_ts',
			'task run timestamp format failed',
			err
		);
		return value;
	}
}

function TaskRunDetail({ run }: { run: EwaCompanionAdminTaskRun }) {
	const { t } = useTranslation('desktopUi');
	return (
		<div className="mt-4 space-y-3 rounded-lg border border-white/10 bg-black/30 p-4">
			<div className="grid gap-2 text-sm text-(--desktop-text-secondary) md:grid-cols-2">
				<div>
					<span className="text-(--desktop-text-dim)">
						{t('ewaCompanionAdmin.taskRunId')}:
					</span>{' '}
					<span className="font-mono text-xs">{run.id}</span>
				</div>
				<div>
					<span className="text-(--desktop-text-dim)">
						{t('ewaCompanionAdmin.taskRunPrincipal')}:
					</span>{' '}
					<span className="font-mono text-xs">{run.principal_id}</span>
				</div>
				<div>
					<span className="text-(--desktop-text-dim)">
						{t('ewaCompanionAdmin.taskRunIntent')}:
					</span>{' '}
					{run.intent_kind}
				</div>
				<div>
					<span className="text-(--desktop-text-dim)">
						{t('ewaCompanionAdmin.taskRunMode')}:
					</span>{' '}
					{run.execution_mode ?? 'sync'}
				</div>
			</div>
			<div className="text-sm text-(--desktop-text-muted)">
				<span className="text-(--desktop-text-dim)">
					{t('ewaCompanionAdmin.taskRunUserLine')}:
				</span>{' '}
				{run.user_message || '—'}
			</div>
			{run.steps?.length ? (
				<div>
					<div className="mb-2 text-xs uppercase tracking-wide text-(--desktop-text-dim)">
						{t('ewaCompanionAdmin.taskRunSteps')} ({run.steps.length})
					</div>
					<ul className="space-y-1 text-xs text-(--desktop-text-muted)">
						{run.steps.map((step) => (
							<li key={step.id}>
								#{step.step_index} {step.step_kind} · {step.status} ·{' '}
								{step.title}
							</li>
						))}
					</ul>
				</div>
			) : null}
			<pre className="max-h-64 overflow-auto rounded border border-white/10 bg-black/40 p-3 text-xs text-(--desktop-text-secondary)">
				{JSON.stringify(
					{
						plan_payload: run.plan_payload,
						result_payload: run.result_payload,
						error_payload: run.error_payload,
						confirmation_state: run.confirmation_state,
					},
					null,
					2
				)}
			</pre>
		</div>
	);
}

export function EwaCompanionTaskRunsTab({
	initialPrincipalId = null,
}: {
	initialPrincipalId?: string | null;
} = {}): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [statusFilter, setStatusFilter] = useState('');
	const [principalFilter, setPrincipalFilter] = useState('');
	const [intentFilter, setIntentFilter] = useState('');
	const [selectedId, setSelectedId] = useState<string | null>(null);

	useEffect(() => {
		const next = (initialPrincipalId ?? '').trim();
		if (!next) return;
		setPrincipalFilter(next);
		setSelectedId(null);
	}, [initialPrincipalId]);

	const listQuery = useQuery({
		queryKey: [
			'ewa',
			'admin',
			'companion',
			'task-runs',
			statusFilter,
			principalFilter,
			intentFilter,
		],
		queryFn: () =>
			fetchEwaCompanionAdminTaskRuns({
				limit: 50,
				status: statusFilter || undefined,
				principal_id: principalFilter || undefined,
				intent_kind: intentFilter || undefined,
			}),
		refetchInterval: (query) => {
			const normalizedFilter = statusFilter.trim();
			if (normalizedFilter && TERMINAL_STATUSES.has(normalizedFilter)) {
				return false;
			}
			const runs = query.state.data?.runs;
			if (!runs?.length) {
				return TASK_RUNS_POLL_MS;
			}
			const hasActive = runs.some(
				(run) => !TERMINAL_STATUSES.has(run.status.trim())
			);
			return hasActive ? TASK_RUNS_POLL_MS : false;
		},
		staleTime: 0,
		retry: false,
	});

	const detailQuery = useQuery({
		queryKey: ['ewa', 'admin', 'companion', 'task-run', selectedId],
		queryFn: () => fetchEwaCompanionAdminTaskRunDetail(selectedId ?? ''),
		enabled: Boolean(selectedId),
		refetchInterval: (query) => {
			const status = query.state.data?.status?.trim() ?? '';
			if (!status) {
				return TASK_RUNS_POLL_MS;
			}
			return TERMINAL_STATUSES.has(status) ? false : TASK_RUNS_POLL_MS;
		},
		staleTime: 0,
		retry: false,
	});

	const errorMessage = useAdminErrorMessage(listQuery.error);
	const runs = listQuery.data?.runs ?? [];

	const intentOptions = useMemo(() => {
		const set = new Set<string>();
		for (const run of runs) {
			if (run.intent_kind) {
				set.add(run.intent_kind);
			}
		}
		return [...set].sort();
	}, [runs]);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end gap-3">
				<label className="flex flex-col gap-1 text-xs text-(--desktop-text-muted)">
					{t('ewaCompanionAdmin.taskRunFilterStatus')}
					<select
						className={`${DESKTOP_INTERACTIVE.btnRounded} bg-black/30 px-2 py-1.5 text-sm text-(--desktop-text-primary)`}
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
					>
						<option value="">{t('ewaCompanionAdmin.taskRunFilterAll')}</option>
						{STATUS_OPTIONS.filter(Boolean).map((st) => (
							<option key={st} value={st}>
								{st}
							</option>
						))}
					</select>
				</label>
				<label className="flex min-w-[12rem] flex-col gap-1 text-xs text-(--desktop-text-muted)">
					{t('ewaCompanionAdmin.taskRunFilterPrincipal')}
					<input
						className={`${DESKTOP_INTERACTIVE.btnRounded} bg-black/30 px-2 py-1.5 text-sm text-(--desktop-text-primary)`}
						value={principalFilter}
						onChange={(e) => setPrincipalFilter(e.target.value)}
						placeholder={t('ewaCompanionAdmin.taskRunFilterPrincipalHint')}
					/>
				</label>
				<label className="flex flex-col gap-1 text-xs text-(--desktop-text-muted)">
					{t('ewaCompanionAdmin.taskRunFilterIntent')}
					<select
						className={`${DESKTOP_INTERACTIVE.btnRounded} bg-black/30 px-2 py-1.5 text-sm text-(--desktop-text-primary)`}
						value={intentFilter}
						onChange={(e) => setIntentFilter(e.target.value)}
					>
						<option value="">{t('ewaCompanionAdmin.taskRunFilterAll')}</option>
						{intentOptions.map((ik) => (
							<option key={ik} value={ik}>
								{ik}
							</option>
						))}
					</select>
				</label>
			</div>

			{listQuery.isLoading ? (
				<p className={`${DESKTOP_TYPOGRAPHY.meta} text-(--desktop-text-muted)`}>
					{t('ewaCompanionAdmin.loadingTaskRuns')}
				</p>
			) : errorMessage ? (
				<div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
					{errorMessage}
				</div>
			) : runs.length === 0 ? (
				<p className={`${DESKTOP_TYPOGRAPHY.meta} text-(--desktop-text-muted)`}>
					{t('ewaCompanionAdmin.emptyTaskRuns')}
				</p>
			) : (
				<div className="overflow-auto rounded-lg border border-white/10">
					<table className="min-w-full text-left text-sm text-(--desktop-text-primary)">
						<thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-(--desktop-text-muted)">
							<tr>
								<th className="px-3 py-2">
									{t('ewaCompanionAdmin.taskRunColTime')}
								</th>
								<th className="px-3 py-2">
									{t('ewaCompanionAdmin.taskRunColStatus')}
								</th>
								<th className="px-3 py-2">
									{t('ewaCompanionAdmin.taskRunColIntent')}
								</th>
								<th className="px-3 py-2">
									{t('ewaCompanionAdmin.taskRunColPrincipal')}
								</th>
								<th className="px-3 py-2">
									{t('ewaCompanionAdmin.taskRunColMessage')}
								</th>
							</tr>
						</thead>
						<tbody>
							{runs.map((run) => (
								<tr
									key={run.id}
									className={`cursor-pointer border-t border-white/5 hover:bg-white/[0.03] ${
										selectedId === run.id
											? 'bg-[rgb(var(--desktop-accent-rgb)/0.1)]'
											: ''
									}`}
									onClick={() =>
										setSelectedId((prev) => (prev === run.id ? null : run.id))
									}
								>
									<td className="px-3 py-2 whitespace-nowrap text-xs text-(--desktop-text-muted)">
										{formatTs(run.created_at)}
									</td>
									<td className="px-3 py-2">
										<span
											className={`inline-flex rounded px-1.5 py-0.5 text-xs ${statusBadgeClass(run.status)}`}
										>
											{run.status}
										</span>
									</td>
									<td className="px-3 py-2 font-mono text-xs">
										{run.intent_kind}
									</td>
									<td className="max-w-[10rem] truncate px-3 py-2 font-mono text-xs">
										<button
											type="button"
											className="truncate text-left text-[rgb(var(--desktop-accent-rgb)/0.9)] underline-offset-2 hover:underline"
											title={t('ewaCompanionAdmin.taskRunOpenUser')}
											onClick={(e) => {
												e.stopPropagation();
												setPrincipalFilter(run.principal_id);
											}}
										>
											{run.principal_id}
										</button>
									</td>
									<td className="max-w-md truncate px-3 py-2 text-(--desktop-text-muted)">
										{run.user_message}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{selectedId && detailQuery.isLoading ? (
				<p className={`${DESKTOP_TYPOGRAPHY.meta} text-(--desktop-text-muted)`}>
					{t('ewaCompanionAdmin.loadingDetail')}
				</p>
			) : null}
			{detailQuery.data ? <TaskRunDetail run={detailQuery.data} /> : null}
		</div>
	);
}
