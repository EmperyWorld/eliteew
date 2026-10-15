/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Search Admin overview tab: Yandex readiness summary, health, cache, quick actions.
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
import { type SearchMetaResponse, getAdminSearchMeta } from '../adminSearchApi';

function statusBadgeClass(ok: boolean): string {
	return ok
		? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
		: 'border-red-500/40 bg-red-500/10 text-red-200';
}

export interface SearchOverviewTabProps {
	onOpenTest?: () => void;
	onOpenDiagnostics?: () => void;
}

export function SearchOverviewTab({
	onOpenTest,
	onOpenDiagnostics,
}: SearchOverviewTabProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [meta, setMeta] = React.useState<SearchMetaResponse | null>(null);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const load = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			setMeta(await getAdminSearchMeta());
		} catch (err) {
			log.error(
				'SearchOverviewTab',
				'meta load failed',
				err instanceof Error ? err : undefined
			);
			setError(t('adminSearch.metaLoadError'));
		} finally {
			setLoading(false);
		}
	}, [t]);

	React.useEffect(() => {
		void load();
	}, [load]);

	const yandexReady = meta?.providers.yandex.credentials_ready ?? false;
	const providerReady = Boolean(meta?.resolved_provider);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap justify-end gap-2">
				<button
					type="button"
					onClick={() => void load()}
					disabled={loading}
					className={`${DESKTOP_INTERACTIVE.btnRounded} inline-flex items-center gap-1 border border-white/10 px-3 py-1.5 text-sm text-slate-200`}
				>
					<ArrowPathIcon className="h-4 w-4" />
					{t('adminSearch.refresh')}
				</button>
				{onOpenDiagnostics ? (
					<button
						type="button"
						onClick={onOpenDiagnostics}
						className={`${DESKTOP_INTERACTIVE.btnRounded} border border-white/10 px-3 py-1.5 text-sm text-slate-200`}
					>
						{t('adminSearch.openDiagnostics')}
					</button>
				) : null}
				{onOpenTest ? (
					<button
						type="button"
						onClick={onOpenTest}
						className={`${DESKTOP_INTERACTIVE.btnRounded} bg-violet-600/80 px-3 py-1.5 text-sm text-white`}
					>
						{t('adminSearch.openTestSearch')}
					</button>
				) : null}
			</div>

			{error ? (
				<p className={`${DESKTOP_TYPOGRAPHY.body} text-red-300`}>{error}</p>
			) : null}

			{loading && !meta ? (
				<p className={DESKTOP_TYPOGRAPHY.meta}>{t('adminSearch.loading')}</p>
			) : null}

			{meta ? (
				<>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<div
							className={`rounded-lg border px-4 py-3 ${statusBadgeClass(providerReady)}`}
						>
							<p className="text-xs uppercase tracking-wide opacity-80">
								{t('adminSearch.cardProvider')}
							</p>
							<p className="mt-1 text-lg font-semibold">
								{meta.resolved_provider ?? t('adminSearch.unavailable')}
							</p>
							<p className="mt-1 text-xs opacity-80">
								{t('adminSearch.providerLabel')}: {meta.provider}
							</p>
						</div>
						<div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
							<p className="text-xs uppercase tracking-wide text-slate-400">
								{t('adminSearch.cardConfigSource')}
							</p>
							<p className="mt-1 text-lg font-semibold text-white">
								{meta.config_source}
							</p>
							<p className="mt-1 text-xs text-slate-400">
								{meta.updated_at ?? '—'}
							</p>
						</div>
						<div
							className={`rounded-lg border px-4 py-3 ${statusBadgeClass(yandexReady)}`}
						>
							<p className="text-xs uppercase tracking-wide opacity-80">
								Yandex
							</p>
							<p className="mt-1 text-sm">
								{yandexReady
									? t('adminSearch.ready')
									: t('adminSearch.notConfigured')}
							</p>
						</div>
						<div
							className={`rounded-lg border px-4 py-3 ${statusBadgeClass(meta.cache.enabled)}`}
						>
							<p className="text-xs uppercase tracking-wide opacity-80">
								{t('adminSearch.cardCache')}
							</p>
							<p className="mt-1 text-sm">
								{meta.cache.enabled
									? t('adminSearch.cacheEnabled')
									: t('adminSearch.cacheDisabled')}
							</p>
							<p className="mt-1 text-xs opacity-80">
								TTL {meta.cache.ttl_sec}s · empty {meta.cache.empty_ttl_sec}s
							</p>
						</div>
					</div>

					<div
						className={`rounded-lg border px-4 py-3 ${
							meta.health.probe_recommended
								? 'border-amber-500/30 bg-amber-500/10'
								: 'border-white/10 bg-black/20'
						}`}
					>
						<p className={`${DESKTOP_TYPOGRAPHY.caption} mb-2`}>
							{t('adminSearch.healthTitle')}
						</p>
						<div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
							<p>
								{t('adminSearch.healthLastSuccess')}:{' '}
								{meta.health.last_success_at ?? '—'}
							</p>
							<p>
								{t('adminSearch.healthErrorStreak')}: {meta.health.error_streak}
							</p>
							<p>
								{t('adminSearch.healthErrorsLastHour')}:{' '}
								{meta.health.errors_last_hour}
							</p>
							<p>
								{t('adminSearch.healthProbeRecommended')}:{' '}
								{meta.health.probe_recommended
									? t('adminSearchConfig.yes')
									: t('adminSearchConfig.no')}
							</p>
						</div>
					</div>

					<div className="rounded-lg border border-white/10 bg-black/20 p-4">
						<p className={`${DESKTOP_TYPOGRAPHY.caption} mb-3`}>
							{t('adminSearch.surfacesSummary')}
						</p>
						<div className="flex flex-wrap gap-2">
							{meta.surfaces.map((row) => {
								const ok =
									row.enabled &&
									row.blockers.length === 0 &&
									Boolean(row.resolved_provider);
								return (
									<span
										key={row.id}
										className={`rounded-full border px-3 py-1 text-xs ${statusBadgeClass(ok)}`}
									>
										{row.id}: {row.resolved_provider ?? '—'}
									</span>
								);
							})}
						</div>
					</div>

					<div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
						<p>
							{t('adminSearch.quotaSummary', {
								enforced: meta.quota.enforced
									? t('adminSearchConfig.yes')
									: t('adminSearchConfig.no'),
								monthly: meta.quota.monthly_free_default,
								limit: meta.quota.default_limit,
							})}
						</p>
					</div>
				</>
			) : null}
		</div>
	);
}
