/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Content Admin processing failures tab: paginated failed content rows with deep-link to Content Manager.
 *
 * Related:
 * - `pages/Admin/contentAdminApi.ts`
 * - `pages/Admin/content/adminContentOpenInManager.ts`
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
	ArrowPathIcon,
	ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { log } from '../../../utils/logger';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '../../Desktop/constants';
import {
	type ContentProcessingFailuresResponse,
	getAdminContentProcessingFailures,
} from '../contentAdminApi';
import {
	contentProcessingFailureLabel,
	useAdminOpenContentInManager,
} from './adminContentOpenInManager';

const PAGE_SIZE = 25;

export function ContentProcessingFailuresTab(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const openContentInManager = useAdminOpenContentInManager();
	const [data, setData] =
		React.useState<ContentProcessingFailuresResponse | null>(null);
	const [offset, setOffset] = React.useState(0);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const load = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			setData(
				await getAdminContentProcessingFailures({
					limit: PAGE_SIZE,
					offset,
				})
			);
		} catch (err) {
			log.error(
				'ContentProcessingFailuresTab',
				'load failed',
				err instanceof Error ? err : undefined
			);
			setError(t('adminContent.failuresLoadError'));
		} finally {
			setLoading(false);
		}
	}, [offset, t]);

	React.useEffect(() => {
		void load();
	}, [load]);

	const total = data?.total ?? 0;
	const canPrev = offset > 0;
	const canNext = data != null && offset + PAGE_SIZE < total;

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className={DESKTOP_TYPOGRAPHY.meta}>
					{t('adminContent.failuresTotal', { total })}
				</p>
				<button
					type="button"
					onClick={() => void load()}
					disabled={loading}
					className={`${DESKTOP_INTERACTIVE.btnRounded} inline-flex items-center gap-1 border border-white/10 px-3 py-1.5 text-sm`}
				>
					<ArrowPathIcon className="h-4 w-4" />
					{t('adminContent.refresh')}
				</button>
			</div>

			{error ? (
				<p className="text-sm text-red-300" role="alert">
					{error}
				</p>
			) : null}

			{loading && !data ? (
				<p className={DESKTOP_TYPOGRAPHY.meta}>{t('adminContent.loading')}</p>
			) : null}

			{data?.items.length ? (
				<div className="overflow-x-auto rounded-xl border border-white/10">
					<table className="min-w-full text-sm">
						<thead className="bg-white/4 text-left text-slate-400">
							<tr>
								<th className="px-3 py-2">{t('adminContent.colContent')}</th>
								<th className="px-3 py-2">{t('adminContent.colUser')}</th>
								<th className="px-3 py-2">{t('adminContent.colStatus')}</th>
								<th className="px-3 py-2">{t('adminContent.colError')}</th>
								<th className="px-3 py-2">{t('adminContent.colUpdated')}</th>
								<th className="px-3 py-2">{t('adminContent.colActions')}</th>
							</tr>
						</thead>
						<tbody>
							{data.items.map((row) => {
								const label = contentProcessingFailureLabel(row);
								return (
									<tr key={row.id} className="border-t border-white/5">
										<td className="px-3 py-2 text-slate-200">
											<button
												type="button"
												className="max-w-xs truncate text-left text-violet-200 underline-offset-2 hover:text-violet-100 hover:underline"
												title={label}
												onClick={() => openContentInManager(row.id)}
											>
												{label}
											</button>
										</td>
										<td className="px-3 py-2 font-mono text-xs text-slate-400">
											{row.user_id ?? '—'}
										</td>
										<td className="px-3 py-2 text-slate-300">
											{row.processing_status ?? '—'}
										</td>
										<td className="px-3 py-2 text-slate-300">
											{row.processing_error ?? '—'}
										</td>
										<td className="px-3 py-2 text-slate-400">
											{row.updated_at ?? '—'}
										</td>
										<td className="px-3 py-2">
											<button
												type="button"
												onClick={() => openContentInManager(row.id)}
												className={`${DESKTOP_INTERACTIVE.btnRounded} inline-flex items-center gap-1 border border-white/10 px-2 py-1 text-xs text-slate-200 hover:bg-white/6`}
												aria-label={t('adminContent.openInContentManagerAria', {
													name: label,
												})}
											>
												<ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 shrink-0" />
												{t('adminContent.openInContentManager')}
											</button>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			) : !loading && !error ? (
				<p className={DESKTOP_TYPOGRAPHY.meta}>
					{t('adminContent.noFailures')}
				</p>
			) : null}

			{total > PAGE_SIZE ? (
				<div className="flex gap-2">
					<button
						type="button"
						disabled={!canPrev || loading}
						onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
						className={`${DESKTOP_INTERACTIVE.btnRounded} border border-white/10 px-3 py-1.5 text-sm disabled:opacity-40`}
					>
						{t('adminContent.prevPage')}
					</button>
					<button
						type="button"
						disabled={!canNext || loading}
						onClick={() => setOffset((o) => o + PAGE_SIZE)}
						className={`${DESKTOP_INTERACTIVE.btnRounded} border border-white/10 px-3 py-1.5 text-sm disabled:opacity-40`}
					>
						{t('adminContent.nextPage')}
					</button>
				</div>
			) : null}
		</div>
	);
}
