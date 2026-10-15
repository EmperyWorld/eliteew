/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Content Admin quota tab — multi-user page (`GET …/quota/users`) plus single-user lookup.
 *
 * Invariants:
 * - Uses content-ops `/quota/users` routes only (not legacy `?user_id=`).
 * - New World atoms for controls/table; deep-link to Users remains optional.
 *
 * Related:
 * - `pages/Admin/contentAdminApi.ts`
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { log } from '../../../utils/logger';
import {
	type ContentOpsQuotaResponse,
	type ContentUserQuotaRow,
	getAdminContentOpsQuota,
	getAdminContentOpsQuotaUsersPage,
} from '../contentAdminApi';
import {
	AdminButton,
	AdminDataTable,
	AdminField,
	AdminStatusBanner,
	type AdminDataTableColumn,
} from '../ui';

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024)
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const PAGE_SIZE = 50;

export interface ContentQuotaTabProps {
	onOpenUserInAdmin?: (userId: string) => void;
}

export function ContentQuotaTab({
	onOpenUserInAdmin,
}: ContentQuotaTabProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [userId, setUserId] = React.useState('');
	const [lookupBusy, setLookupBusy] = React.useState(false);
	const [quota, setQuota] = React.useState<ContentOpsQuotaResponse | null>(
		null
	);
	const [error, setError] = React.useState<string | null>(null);

	const [pageBusy, setPageBusy] = React.useState(false);
	const [offset, setOffset] = React.useState(0);
	const [total, setTotal] = React.useState(0);
	const [rows, setRows] = React.useState<ContentUserQuotaRow[]>([]);

	const loadPage = React.useCallback(
		async (nextOffset: number) => {
			setPageBusy(true);
			setError(null);
			try {
				const page = await getAdminContentOpsQuotaUsersPage({
					limit: PAGE_SIZE,
					offset: nextOffset,
				});
				setRows(page.items);
				setTotal(page.total);
				setOffset(page.offset);
			} catch (err) {
				log.error(
					'ContentQuotaTab',
					'quota page failed',
					err instanceof Error ? err : undefined
				);
				setError(t('adminContent.quotaLookupError'));
			} finally {
				setPageBusy(false);
			}
		},
		[t]
	);

	React.useEffect(() => {
		void loadPage(0);
	}, [loadPage]);

	const lookup = React.useCallback(async () => {
		const id = userId.trim();
		if (!id) return;
		setLookupBusy(true);
		setError(null);
		setQuota(null);
		try {
			setQuota(await getAdminContentOpsQuota(id));
		} catch (err) {
			log.error(
				'ContentQuotaTab',
				'quota lookup failed',
				err instanceof Error ? err : undefined
			);
			setError(t('adminContent.quotaLookupError'));
		} finally {
			setLookupBusy(false);
		}
	}, [t, userId]);

	const columns = React.useMemo<AdminDataTableColumn<ContentUserQuotaRow>[]>(
		() => [
			{
				id: 'email',
				header: t('adminContent.quotaColEmail', 'Email'),
				cell: (row) => row.email ?? '—',
			},
			{
				id: 'used',
				header: t('adminContent.quotaUsed'),
				cell: (row) => formatBytes(row.storage_used_bytes),
			},
			{
				id: 'limit',
				header: t('adminContent.quotaLimit'),
				cell: (row) =>
					row.storage_quota_bytes > 0
						? formatBytes(row.storage_quota_bytes)
						: t('adminContent.quotaUnlimited'),
			},
			{
				id: 'remaining',
				header: t('adminContent.quotaRemaining', 'Remaining'),
				cell: (row) => formatBytes(row.storage_remaining_bytes),
			},
			{
				id: 'actions',
				header: t('adminContent.quotaColActions', 'Actions'),
				cell: (row) =>
					onOpenUserInAdmin ? (
						<AdminButton
							variant="ghost"
							onClick={() => onOpenUserInAdmin(row.user_id)}
						>
							{t('adminContent.openInUsers')}
						</AdminButton>
					) : (
						<span className="font-mono text-xs text-slate-500">
							{row.user_id.slice(0, 8)}…
						</span>
					),
			},
		],
		[onOpenUserInAdmin, t]
	);

	const canPrev = offset > 0;
	const canNext = offset + rows.length < total;

	return (
		<div className="space-y-6">
			<div className="space-y-3">
				<p className="text-sm text-slate-400">
					{t(
						'adminContent.quotaPageHint',
						'Paged storage usage across users (content-ops quota/users).'
					)}
				</p>
				<div className="flex flex-wrap gap-2">
					<AdminButton
						variant="secondary"
						disabled={pageBusy}
						onClick={() => void loadPage(offset)}
					>
						{pageBusy
							? t('adminContent.loading')
							: t('adminContent.refreshQuotaPage', 'Refresh table')}
					</AdminButton>
					<AdminButton
						variant="ghost"
						disabled={pageBusy || !canPrev}
						onClick={() => void loadPage(Math.max(0, offset - PAGE_SIZE))}
					>
						{t('adminContent.prevPage', 'Previous')}
					</AdminButton>
					<AdminButton
						variant="ghost"
						disabled={pageBusy || !canNext}
						onClick={() => void loadPage(offset + PAGE_SIZE)}
					>
						{t('adminContent.nextPage', 'Next')}
					</AdminButton>
					<span className="self-center text-xs text-slate-500">
						{t('adminContent.quotaPageMeta', {
							defaultValue: '{{from}}–{{to}} of {{total}}',
							from: total === 0 ? 0 : offset + 1,
							to: offset + rows.length,
							total,
						})}
					</span>
				</div>
				<AdminDataTable
					columns={columns}
					rows={rows}
					rowKey={(r) => r.user_id}
				/>
			</div>

			<div className="max-w-lg space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
				<p className="text-sm text-slate-400">{t('adminContent.quotaHint')}</p>
				<div className="block space-y-1">
					<span className="text-xs text-slate-400">
						{t('adminContent.testUserId')}
					</span>
					<AdminField
						aria-label={t('adminContent.testUserId')}
						value={userId}
						onChange={(e) => setUserId(e.target.value)}
						placeholder="UUID"
					/>
				</div>
				<AdminButton
					variant="primary"
					disabled={lookupBusy || !userId.trim()}
					onClick={() => void lookup()}
				>
					{lookupBusy
						? t('adminContent.loading')
						: t('adminContent.quotaLookup')}
				</AdminButton>

				{quota ? (
					<div className="space-y-2 rounded-lg border border-white/10 p-3 text-sm text-slate-200">
						<p>
							{t('adminContent.quotaUsed')}: {formatBytes(quota.used_bytes)}
						</p>
						<p>
							{t('adminContent.quotaLimit')}:{' '}
							{quota.quota_bytes != null && quota.quota_bytes > 0
								? formatBytes(quota.quota_bytes)
								: t('adminContent.quotaUnlimited')}
						</p>
						<p>
							{t('adminContent.quotaEnforced')}:{' '}
							{quota.quota_enforced
								? t('adminContent.yes')
								: t('adminContent.no')}
						</p>
						{onOpenUserInAdmin ? (
							<AdminButton
								variant="secondary"
								onClick={() => onOpenUserInAdmin(quota.user_id)}
							>
								{t('adminContent.openInUsers')}
							</AdminButton>
						) : null}
					</div>
				) : null}
			</div>

			{error ? (
				<AdminStatusBanner tone="danger">{error}</AdminStatusBanner>
			) : null}
		</div>
	);
}
