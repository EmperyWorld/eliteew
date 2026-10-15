/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * UGS Admin v2 Queue-ops tab — read-only snapshot via New World table atoms (Wave 1).
 *
 * Invariants:
 * - Read-only; mutations stay on Workers / Hub tooling.
 * - Uses useUgsQueueOpsSnapshot (shared query key with Hub).
 *
 * Related:
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 * - documentation/platform/docker-re_doc/UGS-QUEUE-OPERATIONS-RUNBOOK.md
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useUgsQueueOpsSnapshot } from '@/hooks/api/useUgsQueueOpsSnapshot';
import { UGS_ADMIN_V2_NS } from '@/i18n/namespaces';
import type { UgsQueueOpsRabbitQueue } from '@/services/api/ugs/queueOps';

import {
	AdminButton,
	AdminDataTable,
	AdminStatusBanner,
	type AdminDataTableColumn,
} from '@/pages/Admin/ui';

export function QueueOpsTabV2() {
	const { t } = useTranslation(UGS_ADMIN_V2_NS);
	const query = useUgsQueueOpsSnapshot(true);
	const snapshot = query.data;
	const queues = snapshot?.rabbitmq?.queues ?? [];

	const columns = useMemo<AdminDataTableColumn<UgsQueueOpsRabbitQueue>[]>(
		() => [
			{
				id: 'name',
				header: t('queueOps.colName', 'Queue'),
				cell: (row) => row.name ?? '—',
			},
			{
				id: 'messages',
				header: t('queueOps.colMessages', 'Ready'),
				cell: (row) => String(row.messages_ready ?? '—'),
			},
			{
				id: 'unacked',
				header: t('queueOps.colUnacked', 'Unacked'),
				cell: (row) => String(row.messages_unacknowledged ?? '—'),
			},
		],
		[t]
	);

	const stale = snapshot?.postgres?.stale_candidates;
	const leases = snapshot?.redis?.ugs_worker_leases;

	if (query.isLoading) {
		return (
			<p className="text-sm text-[var(--admin-ui-fg-muted)]">
				{t('queueOps.loading', 'Loading queue snapshot…')}
			</p>
		);
	}

	if (query.isError) {
		return (
			<AdminStatusBanner
				tone="danger"
				title={
					query.error instanceof Error
						? query.error.message
						: t('queueOps.loadError', 'Failed to load queue-ops')
				}
			>
				<AdminButton variant="secondary" onClick={() => void query.refetch()}>
					{t('queueOps.retry', 'Retry')}
				</AdminButton>
			</AdminStatusBanner>
		);
	}

	const leaseActive =
		leases && typeof leases === 'object' && 'active_leases' in leases
			? String(leases.active_leases ?? '—')
			: '—';

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="text-sm text-[var(--admin-ui-fg-muted)]">
					{t(
						'queueOps.subtitle',
						'Read-only Postgres backlog, Redis leases, and Rabbit queues.'
					)}
				</p>
				<AdminButton variant="ghost" onClick={() => void query.refetch()}>
					{t('queueOps.refresh', 'Refresh')}
				</AdminButton>
			</div>

			<div className="grid gap-3 sm:grid-cols-3">
				<AdminStatusBanner
					tone="info"
					title={t('queueOps.staleTitle', 'Stale candidates')}
				>
					{t('queueOps.staleTotal', 'total={{n}}', {
						n: stale?.total ?? '—',
					})}
				</AdminStatusBanner>
				<AdminStatusBanner
					tone="info"
					title={t('queueOps.leasesTitle', 'Worker leases')}
				>
					{t('queueOps.leasesActive', 'active={{n}}', { n: leaseActive })}
				</AdminStatusBanner>
				<AdminStatusBanner
					tone="info"
					title={t('queueOps.rabbitTitle', 'Rabbit queues')}
				>
					{t('queueOps.rabbitCount', 'count={{n}}', { n: queues.length })}
				</AdminStatusBanner>
			</div>

			<AdminDataTable
				columns={columns}
				rows={queues}
				rowKey={(row) => String(row.name ?? Math.random())}
				empty={
					<p className="text-sm text-[var(--admin-ui-fg-muted)]">
						{t('queueOps.emptyQueues', 'No Rabbit queue rows in snapshot.')}
					</p>
				}
			/>
		</div>
	);
}
