/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Search Admin diagnostics tab: Yandex provider probe without chat context.
 *
 * Related:
 * - `pages/Admin/adminSearchApi.ts`
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { PlayIcon } from '@heroicons/react/24/outline';
import { log } from '../../../utils/logger';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '../../Desktop/constants';
import {
	type SearchProbeResponse,
	postAdminSearchProbe,
} from '../adminSearchApi';

export function SearchDiagnosticsTab(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [smokeQuery, setSmokeQuery] = React.useState('');
	const [running, setRunning] = React.useState(false);
	const [result, setResult] = React.useState<SearchProbeResponse | null>(null);
	const [error, setError] = React.useState<string | null>(null);

	const runProbe = React.useCallback(async () => {
		setRunning(true);
		setError(null);
		try {
			const payload = await postAdminSearchProbe({
				smoke_query: smokeQuery.trim() || undefined,
			});
			setResult(payload);
		} catch (err) {
			log.error(
				'SearchDiagnosticsTab',
				'probe failed',
				err instanceof Error ? err : undefined
			);
			setError(
				err instanceof Error ? err.message : t('adminSearch.probeError')
			);
		} finally {
			setRunning(false);
		}
	}, [smokeQuery, t]);

	return (
		<div className="space-y-4">
			<label className="flex max-w-lg flex-col gap-1">
				<span className={DESKTOP_TYPOGRAPHY.caption}>
					{t('adminSearch.probeSmokeQuery')}
				</span>
				<input
					type="text"
					className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
					value={smokeQuery}
					onChange={(e) => setSmokeQuery(e.target.value)}
					placeholder={t('adminSearch.probeSmokePlaceholder')}
				/>
			</label>

			<button
				type="button"
				disabled={running}
				onClick={() => void runProbe()}
				className={`${DESKTOP_INTERACTIVE.btnRounded} inline-flex items-center gap-1 bg-violet-600/80 px-3 py-1.5 text-sm text-white disabled:opacity-50`}
			>
				<PlayIcon className="h-4 w-4" />
				{running ? t('adminSearch.probeRunning') : t('adminSearch.probeYandex')}
			</button>

			{error ? (
				<p className={`${DESKTOP_TYPOGRAPHY.body} text-red-300`}>{error}</p>
			) : null}

			{result ? (
				<div className="space-y-3">
					<p className={DESKTOP_TYPOGRAPHY.meta}>
						{t('adminSearch.probeQueryUsed')}: {result.smoke_query}
					</p>
					{result.results.map((row) => (
						<div
							key={row.target}
							className={`rounded-lg border px-4 py-3 ${
								row.ok
									? 'border-emerald-500/30 bg-emerald-500/10'
									: 'border-red-500/30 bg-red-500/10'
							}`}
						>
							<p className="font-semibold text-white">{row.target}</p>
							<p className="mt-1 text-sm text-slate-200">{row.message}</p>
							<p className="mt-1 text-xs text-slate-400">
								{row.latency_ms} ms
								{row.http_status != null ? ` · HTTP ${row.http_status}` : ''}
								{row.error_code ? ` · ${row.error_code}` : ''}
								{row.hit_count ? ` · hits=${row.hit_count}` : ''}
							</p>
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}
