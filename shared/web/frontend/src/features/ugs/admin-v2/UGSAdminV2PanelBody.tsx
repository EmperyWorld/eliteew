/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS Admin v2 main UI: snapshot-driven tables with selection, grouping primitives, and safe bulk apply flow.
 *
 * Invariants:
 * - All bulk actions go through validate -> show issues -> apply with allow_warnings when confirmed.
 *
 * Related:
 * - src/services/api/ugsAdminV2.ts
 * - src/hooks/api/useUgsAdminV2.ts
 */

import * as React from 'react';
import { useMemo, useState } from 'react';
import {
	AdjustmentsHorizontalIcon,
	Cog6ToothIcon,
	CpuChipIcon,
	PencilSquareIcon,
	QueueListIcon,
	SignalIcon,
	Squares2X2Icon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import EmptyState from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/SkeletonList';
import { useNotifications } from '@/notifications';

import {
	useBulkApplyUgsAdminV2Operations,
	useUgsAdminV2Snapshot,
	useValidateUgsAdminV2Operations,
} from '@/hooks/api/useUgsAdminV2';
import { useBootstrapRuntimeProviders } from '@/hooks/api/useUgsAdmin';
import { UGS_ADMIN_V2_NS } from '@/i18n/namespaces';
import type {
	UgsAdminV2BulkApplyResultDTO,
	UgsAdminV2BulkOperation,
} from '@/services/api/ugsAdminV2';
import {
	UGS_DESKTOP_BTN,
	UGS_DESKTOP_TABS,
	UGS_SEVERITY_BADGE,
} from '@/features/ugs/shared/ugsDesktopUi';
import { cn } from '@/utils/cn';

import { Modal } from '@/features/ugs/shared/ugsAdminUi';
import { ModelsTabV2 } from './tabs/ModelsTabV2';
import { OverviewTabV2 } from './tabs/OverviewTabV2';
import { ProvidersTabV2 } from './tabs/ProvidersTabV2';
import { QueueOpsTabV2 } from './tabs/QueueOpsTabV2';
import { SettingsTabV2 } from './tabs/SettingsTabV2';
import { TypesTabV2 } from './tabs/TypesTabV2';
import { WorkflowsTabV2 } from './tabs/WorkflowsTabV2';

type TabId =
	| 'overview'
	| 'providers'
	| 'types'
	| 'workflows'
	| 'models'
	| 'settings'
	| 'queueOps';

function formatIssuesSummary(
	issues: { severity: string }[],
	t: TFunction<typeof UGS_ADMIN_V2_NS>
): string {
	const errors = issues.filter((i) => i.severity === 'error').length;
	const warnings = issues.filter((i) => i.severity === 'warning').length;
	if (!errors && !warnings) return t('validate.issuesSummaryNone');
	const parts: string[] = [];
	if (errors) parts.push(t('validate.issuesSummaryErrors', { count: errors }));
	if (warnings)
		parts.push(t('validate.issuesSummaryWarnings', { count: warnings }));
	return parts.join(', ');
}

function summarizeOps(ops: UgsAdminV2BulkOperation[]): string[] {
	const counts = new Map<string, number>();
	for (const op of ops) {
		counts.set(op.kind, (counts.get(op.kind) ?? 0) + 1);
	}
	return Array.from(counts.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([kind, n]) => `${kind} × ${n}`);
}

export function UgsAdminV2PanelBody(): React.ReactElement {
	const { t } = useTranslation(UGS_ADMIN_V2_NS);
	const { toast } = useNotifications();
	const [tab, setTab] = useState<TabId>('overview');

	const snapshotQuery = useUgsAdminV2Snapshot(true);
	const validateMutation = useValidateUgsAdminV2Operations();
	const bulkApplyMutation = useBulkApplyUgsAdminV2Operations();
	const bootstrapMutation = useBootstrapRuntimeProviders();

	async function handleBootstrapRuntime() {
		if (bootstrapMutation.isPending) return;
		try {
			const result = await bootstrapMutation.mutateAsync();
			if (result.total_created > 0) {
				toast.success(
					t('bootstrap.addedTitle'),
					t('bootstrap.addedBody', { names: result.created.join(', ') })
				);
			} else {
				toast.info(t('bootstrap.nothingTitle'), t('bootstrap.nothingBody'));
			}
			void snapshotQuery.refetch();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : t('bootstrap.failed'));
		}
	}

	const [confirmOpen, setConfirmOpen] = useState(false);
	const [confirmIssues, setConfirmIssues] = useState<Awaited<
		ReturnType<typeof validateMutation.mutateAsync>
	> | null>(null);
	const [confirmOps, setConfirmOps] = useState<UgsAdminV2BulkOperation[]>([]);
	const [lastApplyResult, setLastApplyResult] =
		useState<UgsAdminV2BulkApplyResultDTO | null>(null);

	const headerTabs = useMemo(
		() => [
			{ id: 'overview', label: t('shell.tabs.overview'), icon: SignalIcon },
			{
				id: 'providers',
				label: t('shell.tabs.providers'),
				icon: Cog6ToothIcon,
			},
			{ id: 'types', label: t('shell.tabs.types'), icon: PencilSquareIcon },
			{
				id: 'workflows',
				label: t('shell.tabs.workflows'),
				icon: Squares2X2Icon,
			},
			{ id: 'models', label: t('shell.tabs.models'), icon: CpuChipIcon },
			{
				id: 'settings',
				label: t('shell.tabs.settings'),
				icon: AdjustmentsHorizontalIcon,
			},
			{
				id: 'queueOps',
				label: t('shell.tabs.queueOps', 'Queue'),
				icon: QueueListIcon,
			},
		],
		[t]
	);

	async function requestBulkApply(operations: UgsAdminV2BulkOperation[]) {
		try {
			const issues = await validateMutation.mutateAsync({ operations });
			setConfirmIssues(issues);
			setConfirmOps(operations);
			setLastApplyResult(null);
			setConfirmOpen(true);
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : t('validate.validationFailed')
			);
		}
	}

	async function confirmApply(allowWarnings: boolean) {
		try {
			const res = await bulkApplyMutation.mutateAsync({
				operations: confirmOps,
				validate_only: false,
				allow_warnings: allowWarnings,
			});
			setLastApplyResult(res);
			const msg = t('validate.doneSummary', {
				applied: res.applied,
				skipped: res.skipped,
				failed: res.failed,
			});
			if (res.failed > 0) {
				toast.error(msg);
			} else {
				toast.success(msg);
			}
			void snapshotQuery.refetch();
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : t('validate.applyFailed')
			);
		}
	}

	const body = (() => {
		if (snapshotQuery.isLoading) return <SkeletonList count={4} />;
		if (snapshotQuery.isError) {
			return (
				<EmptyState
					title={t('shell.loadError.title')}
					description={
						snapshotQuery.error instanceof Error
							? snapshotQuery.error.message
							: t('shell.loadError.fallbackDescription')
					}
					actionLabel={t('shell.loadError.retry')}
					onAction={() => snapshotQuery.refetch()}
				/>
			);
		}
		const snapshot = snapshotQuery.data;
		if (!snapshot) return null;

		if (tab === 'overview') {
			return (
				<OverviewTabV2
					snapshot={snapshot}
					onRequestBulk={requestBulkApply}
					onBootstrapRuntime={handleBootstrapRuntime}
					bootstrapPending={bootstrapMutation.isPending}
				/>
			);
		}
		if (tab === 'providers') {
			return (
				<ProvidersTabV2 snapshot={snapshot} onRequestBulk={requestBulkApply} />
			);
		}
		if (tab === 'types') {
			return (
				<TypesTabV2 snapshot={snapshot} onRequestBulk={requestBulkApply} />
			);
		}
		if (tab === 'workflows') {
			return (
				<WorkflowsTabV2 snapshot={snapshot} onRequestBulk={requestBulkApply} />
			);
		}
		if (tab === 'models') {
			return (
				<ModelsTabV2 snapshot={snapshot} onRequestBulk={requestBulkApply} />
			);
		}
		if (tab === 'queueOps') {
			return <QueueOpsTabV2 />;
		}
		return (
			<SettingsTabV2 snapshot={snapshot} onRequestBulk={requestBulkApply} />
		);
	})();

	const issues = confirmIssues ?? [];
	const hasErrors = issues.some((i) => i.severity === 'error');
	const hasWarnings = issues.some((i) => i.severity === 'warning');
	const opsSummary = summarizeOps(confirmOps);

	return (
		<div className="min-h-0 bg-(--desktop-surface-app) text-(--desktop-text-primary)">
			<div className="w-full min-w-0 max-w-full px-4 py-8 sm:px-6 lg:px-10">
				<div className="mb-8">
					<h1 className="text-3xl font-bold">{t('shell.title')}</h1>
					<p className="mt-2 text-(--desktop-text-muted)">
						{t('shell.subtitle')}
					</p>
				</div>

				<div className={cn('mb-8', UGS_DESKTOP_TABS.rail)}>
					{headerTabs.map((headerTab) => (
						<button
							type="button"
							key={headerTab.id}
							className={
								tab === headerTab.id
									? UGS_DESKTOP_TABS.active
									: UGS_DESKTOP_TABS.idle
							}
							onClick={() => setTab(headerTab.id as TabId)}
						>
							<headerTab.icon
								className="h-4 w-4 shrink-0 opacity-90"
								aria-hidden
							/>
							{headerTab.label}
						</button>
					))}
				</div>

				{body}
			</div>

			<Modal
				open={confirmOpen}
				title={t('validate.modalTitle')}
				onClose={() => setConfirmOpen(false)}
				size="lg"
			>
				<div className="space-y-3">
					{confirmOps.length ? (
						<div className="rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4 text-sm">
							<div className="text-xs font-semibold uppercase tracking-[0.16em] text-(--desktop-text-muted)">
								{t('validate.operations')}
							</div>
							<ul className="mt-2 space-y-1 text-(--desktop-text-secondary)">
								{opsSummary.map((line) => (
									<li key={line} className="font-mono text-[0.75rem]">
										{line}
									</li>
								))}
							</ul>
						</div>
					) : null}
					<p className="text-(--desktop-text-secondary)">
						{formatIssuesSummary(issues, t)}{' '}
						{hasErrors
							? t('validate.fixErrorsRetry')
							: hasWarnings
								? t('validate.confirmWarnings')
								: t('validate.readyToApply')}
					</p>
					{issues.length ? (
						<div className="max-h-72 overflow-auto rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4 text-sm">
							<ul className="space-y-2">
								{issues.map((it) => (
									<li
										key={`${it.entity_type}:${it.entity_id}:${it.field}:${it.message}`}
									>
										<span
											className={
												it.severity === 'error'
													? UGS_SEVERITY_BADGE.error
													: it.severity === 'warning'
														? UGS_SEVERITY_BADGE.warning
														: UGS_SEVERITY_BADGE.info
											}
										>
											{it.severity}
										</span>
										<span className="text-(--desktop-text-primary)">
											{it.entity_type}:{it.entity_id}
										</span>
										{it.field ? (
											<span className="text-(--desktop-text-muted)">
												{' '}
												· {it.field}
											</span>
										) : null}
										<div className="mt-1 text-(--desktop-text-secondary)">
											{it.message}
										</div>
									</li>
								))}
							</ul>
						</div>
					) : (
						<p className="text-(--desktop-text-muted)">
							{t('common.noIssuesFound')}
						</p>
					)}

					{lastApplyResult ? (
						<div className="rounded-xl border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-4 text-sm">
							<div className="text-xs font-semibold uppercase tracking-[0.16em] text-(--desktop-text-muted)">
								{t('validate.applyResult')}
							</div>
							<div className="mt-2 text-(--desktop-text-secondary)">
								{t('validate.applyResultSummary', {
									applied: lastApplyResult.applied,
									skipped: lastApplyResult.skipped,
									failed: lastApplyResult.failed,
								})}
							</div>
							{(lastApplyResult.operation_results?.length ?? 0) > 0 ? (
								<div className="mt-3 max-h-64 overflow-auto rounded-lg border border-(--desktop-border-subtle)">
									<table className="w-full min-w-170 text-left text-xs">
										<thead className="bg-(--desktop-surface-soft) text-(--desktop-text-muted)">
											<tr>
												<th className="px-3 py-2">status</th>
												<th className="px-3 py-2">entity</th>
												<th className="px-3 py-2">kind</th>
												<th className="px-3 py-2">message</th>
											</tr>
										</thead>
										<tbody>
											{lastApplyResult.operation_results?.map((item) => (
												<tr
													key={`${item.kind}:${item.entity_type}:${item.entity_id}:${item.status}:${item.message}`}
													className="border-t border-(--desktop-border-subtle)"
												>
													<td className="px-3 py-2">
														<span
															className={`rounded-full px-2 py-0.5 ${
																item.status === 'failed'
																	? 'bg-rose-500/15 text-rose-200'
																	: item.status === 'skipped'
																		? 'bg-amber-500/15 text-amber-200'
																		: 'bg-emerald-500/15 text-emerald-200'
															}`}
														>
															{item.status}
														</span>
													</td>
													<td className="px-3 py-2 font-mono text-(--desktop-text-secondary)">
														{item.entity_type}:{item.entity_id}
													</td>
													<td className="px-3 py-2 font-mono text-(--desktop-text-muted)">
														{item.kind}
													</td>
													<td className="px-3 py-2 text-(--desktop-text-secondary)">
														{item.message}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							) : null}
						</div>
					) : null}

					<div className="flex flex-wrap gap-3 pt-2">
						<button
							type="button"
							className={cn(UGS_DESKTOP_BTN.secondary, 'disabled:opacity-60')}
							onClick={() => setConfirmOpen(false)}
						>
							{t('common.cancel')}
						</button>
						<button
							type="button"
							className="rounded-lg border border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.14)] px-4 py-2 text-sm font-medium text-(--desktop-text-primary) hover:bg-[rgb(var(--desktop-accent-rgb)/0.22)] disabled:cursor-not-allowed disabled:opacity-60"
							onClick={() => void confirmApply(false)}
							disabled={hasErrors || bulkApplyMutation.isPending}
						>
							{t('validate.apply')}
						</button>
						{hasWarnings ? (
							<button
								type="button"
								className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-(--desktop-text-primary) hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
								onClick={() => void confirmApply(true)}
								disabled={hasErrors || bulkApplyMutation.isPending}
							>
								{t('validate.applyIgnoringWarnings')}
							</button>
						) : null}
					</div>
				</div>
			</Modal>
		</div>
	);
}
