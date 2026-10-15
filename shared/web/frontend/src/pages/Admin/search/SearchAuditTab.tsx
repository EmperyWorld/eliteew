/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Search Admin audit history tab.
 *
 * Related:
 * - `pages/Admin/adminSearchApi.ts`
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { log } from '../../../utils/logger';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '../../Desktop/constants';
import {
	type SearchAuditListResponse,
	getAdminSearchAudit,
} from '../adminSearchApi';

export function SearchAuditTab(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [data, setData] = React.useState<SearchAuditListResponse | null>(null);
	const [loading, setLoading] = React.useState(false);
	const [offset, setOffset] = React.useState(0);
	const limit = 25;

	const load = React.useCallback(async () => {
		setLoading(true);
		try {
			setData(await getAdminSearchAudit({ limit, offset }));
		} catch (error) {
			log.error(
				'SearchAuditTab',
				'audit load failed',
				error instanceof Error ? error : undefined
			);
		} finally {
			setLoading(false);
		}
	}, [offset]);

	React.useEffect(() => {
		void load();
	}, [load]);

	const total = data?.total ?? 0;
	const canPrev = offset > 0;
	const canNext = offset + limit < total;

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className={DESKTOP_TYPOGRAPHY.meta}>
					{t('adminSearch.auditTotal', { total })}
				</p>
				<button
					type="button"
					onClick={() => void load()}
					disabled={loading}
					className={`${DESKTOP_INTERACTIVE.btnRounded} inline-flex items-center gap-1 border border-white/10 px-3 py-1 text-sm`}
				>
					<ArrowPathIcon className="h-4 w-4" />
					{t('adminSearch.refresh')}
				</button>
			</div>

			<div className="overflow-auto rounded-lg border border-white/10">
				<table className="min-w-full text-left text-sm text-slate-200">
					<thead className="bg-white/[0.04] text-xs uppercase text-slate-400">
						<tr>
							<th className="px-3 py-2">{t('adminSearch.colTime')}</th>
							<th className="px-3 py-2">{t('adminSearch.colAction')}</th>
							<th className="px-3 py-2">{t('adminSearch.colActor')}</th>
							<th className="px-3 py-2">{t('adminSearch.colNote')}</th>
							<th className="px-3 py-2">{t('adminSearch.colChanges')}</th>
						</tr>
					</thead>
					<tbody>
						{(data?.items ?? []).map((row) => (
							<tr key={row.id} className="border-t border-white/5">
								<td className="px-3 py-2 text-xs text-slate-400">
									{row.created_at ?? '—'}
								</td>
								<td className="px-3 py-2">{row.action}</td>
								<td className="px-3 py-2 font-mono text-xs">
									{row.actor_user_id?.slice(0, 8) ?? '—'}
								</td>
								<td className="max-w-xs px-3 py-2 text-slate-400">
									{row.note ?? '—'}
								</td>
								<td className="px-3 py-2 text-xs">
									{[
										...row.settings_changed.map((k) => `s:${k}`),
										...row.secrets_changed.map((k) => `sec:${k}`),
									].join(', ') || '—'}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="flex gap-2">
				<button
					type="button"
					disabled={!canPrev || loading}
					onClick={() => setOffset((o) => Math.max(0, o - limit))}
					className={`${DESKTOP_INTERACTIVE.btnRounded} border border-white/10 px-3 py-1 text-sm disabled:opacity-40`}
				>
					{t('adminSearch.prevPage')}
				</button>
				<button
					type="button"
					disabled={!canNext || loading}
					onClick={() => setOffset((o) => o + limit)}
					className={`${DESKTOP_INTERACTIVE.btnRounded} border border-white/10 px-3 py-1 text-sm disabled:opacity-40`}
				>
					{t('adminSearch.nextPage')}
				</button>
			</div>
		</div>
	);
}
