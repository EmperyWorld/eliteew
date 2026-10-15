/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Search Admin stats tab: web-search event aggregates for 24h / 7d periods.
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
	type SearchStatsPeriod,
	type SearchStatsResponse,
	getAdminSearchStats,
} from '../adminSearchApi';

function formatRate(value: number): string {
	return `${(value * 100).toFixed(1)}%`;
}

export function SearchStatsTab(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [period, setPeriod] = React.useState<SearchStatsPeriod>('24h');
	const [stats, setStats] = React.useState<SearchStatsResponse | null>(null);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const load = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			setStats(await getAdminSearchStats(period));
		} catch (err) {
			log.error(
				'SearchStatsTab',
				'stats load failed',
				err instanceof Error ? err : undefined
			);
			setError(t('adminSearch.statsLoadError'));
		} finally {
			setLoading(false);
		}
	}, [period, t]);

	React.useEffect(() => {
		void load();
	}, [load]);

	const periodButtons: SearchStatsPeriod[] = ['24h', '7d'];

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex gap-2">
					{periodButtons.map((p) => (
						<button
							key={p}
							type="button"
							onClick={() => setPeriod(p)}
							className={`${DESKTOP_INTERACTIVE.btnRounded} px-3 py-1.5 text-sm ${
								period === p
									? 'bg-violet-600/30 text-white ring-1 ring-violet-400/40'
									: 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
							}`}
						>
							{p === '24h'
								? t('adminSearch.statsPeriod24h')
								: t('adminSearch.statsPeriod7d')}
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={() => void load()}
					disabled={loading}
					className={`${DESKTOP_INTERACTIVE.btnRounded} inline-flex items-center gap-1 border border-white/10 px-3 py-1.5 text-sm text-slate-200`}
				>
					<ArrowPathIcon className="h-4 w-4" />
					{t('adminSearch.refresh')}
				</button>
			</div>

			{error ? (
				<p className={`${DESKTOP_TYPOGRAPHY.body} text-red-300`}>{error}</p>
			) : null}

			{loading && !stats ? (
				<p className={DESKTOP_TYPOGRAPHY.meta}>{t('adminSearch.loading')}</p>
			) : null}

			{stats ? (
				<>
					<p className={DESKTOP_TYPOGRAPHY.meta}>
						{t('adminSearch.statsSince')}: {stats.since}
					</p>

					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
							<p className="text-xs uppercase tracking-wide text-slate-400">
								{t('adminSearch.statsTotal')}
							</p>
							<p className="mt-1 text-lg font-semibold text-white">
								{stats.total}
							</p>
						</div>
						<div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
							<p className="text-xs uppercase tracking-wide text-emerald-200/80">
								{t('adminSearch.statsOk')}
							</p>
							<p className="mt-1 text-lg font-semibold text-emerald-100">
								{stats.ok}
							</p>
						</div>
						<div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
							<p className="text-xs uppercase tracking-wide text-amber-200/80">
								{t('adminSearch.statsEmpty')}
							</p>
							<p className="mt-1 text-lg font-semibold text-amber-100">
								{stats.empty}{' '}
								<span className="text-sm font-normal opacity-80">
									({formatRate(stats.empty_rate)})
								</span>
							</p>
						</div>
						<div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
							<p className="text-xs uppercase tracking-wide text-red-200/80">
								{t('adminSearch.statsError')}
							</p>
							<p className="mt-1 text-lg font-semibold text-red-100">
								{stats.error}{' '}
								<span className="text-sm font-normal opacity-80">
									({formatRate(stats.error_rate)})
								</span>
							</p>
						</div>
					</div>

					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
							<p className="text-xs uppercase tracking-wide text-slate-400">
								{t('adminSearch.statsBlocked')}
							</p>
							<p className="mt-1 text-lg font-semibold text-white">
								{stats.blocked}
							</p>
						</div>
						<div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
							<p className="text-xs uppercase tracking-wide text-slate-400">
								{t('adminSearch.statsQuotaDenied')}
							</p>
							<p className="mt-1 text-lg font-semibold text-white">
								{stats.quota_denied}
							</p>
						</div>
						<div className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-3">
							<p className="text-xs uppercase tracking-wide text-violet-200/80">
								{t('adminSearch.statsCacheHits')}
							</p>
							<p className="mt-1 text-lg font-semibold text-violet-100">
								{stats.cache_hits}{' '}
								<span className="text-sm font-normal opacity-80">
									({formatRate(stats.cache_hit_rate)})
								</span>
							</p>
						</div>
						<div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
							<p className="text-xs uppercase tracking-wide text-slate-400">
								{t('adminSearch.statsLatency')}
							</p>
							<p className="mt-1 text-sm font-semibold text-white">
								p50 {stats.latency_ms_p50} ms · p95 {stats.latency_ms_p95} ms
							</p>
						</div>
					</div>

					{stats.by_surface.length ? (
						<div className="rounded-lg border border-white/10 bg-black/20 p-4">
							<p className={`${DESKTOP_TYPOGRAPHY.caption} mb-3`}>
								{t('adminSearch.statsBySurface')}
							</p>
							<div className="flex flex-wrap gap-2">
								{stats.by_surface.map((row) => (
									<span
										key={row.surface}
										className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-200"
									>
										{row.surface}: {row.total}
									</span>
								))}
							</div>
						</div>
					) : null}
				</>
			) : null}
		</div>
	);
}
