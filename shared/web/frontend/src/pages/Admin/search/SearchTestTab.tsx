/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Search Admin test-search tab: run queries and preview hits + LLM block.
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
	type SearchQueryPreviewResponse,
	type SearchSurfaceKey,
	type SearchTestSearchResponse,
	postAdminSearchQueryPreview,
	postAdminSearchTest,
} from '../adminSearchApi';

const PRESET_QUERIES = [
	'новости технологий сегодня',
	'EliteEW Empery World',
	'weather Vladivostok today',
] as const;

const SURFACES: SearchSurfaceKey[] = [
	'desktop',
	'ewa',
	'marketing',
	'imperorg',
	'ugs',
];

export interface SearchTestTabProps {
	initialSurface?: SearchSurfaceKey;
	initialQuery?: string;
}

export function SearchTestTab({
	initialSurface,
	initialQuery = '',
}: SearchTestTabProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [query, setQuery] = React.useState(initialQuery);
	const [surface, setSurface] = React.useState<SearchSurfaceKey | ''>(
		initialSurface ?? 'desktop'
	);
	const [limit, setLimit] = React.useState(8);
	const [consumeQuota, setConsumeQuota] = React.useState(false);
	const [simulateChatQuery, setSimulateChatQuery] = React.useState(true);
	const [userId, setUserId] = React.useState('');
	const [running, setRunning] = React.useState(false);
	const [previewRunning, setPreviewRunning] = React.useState(false);
	const [preview, setPreview] =
		React.useState<SearchQueryPreviewResponse | null>(null);
	const [previewError, setPreviewError] = React.useState<string | null>(null);
	const [result, setResult] = React.useState<SearchTestSearchResponse | null>(
		null
	);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		if (initialQuery) setQuery(initialQuery);
	}, [initialQuery]);

	React.useEffect(() => {
		if (initialSurface) setSurface(initialSurface);
	}, [initialSurface]);

	const runPreview = React.useCallback(async () => {
		const trimmed = query.trim();
		if (!trimmed) return;
		setPreviewRunning(true);
		setPreviewError(null);
		try {
			setPreview(
				await postAdminSearchQueryPreview({
					query: trimmed,
					simulate_chat_query: simulateChatQuery,
				})
			);
		} catch (err) {
			log.error(
				'SearchTestTab',
				'preview failed',
				err instanceof Error ? err : undefined
			);
			setPreviewError(
				err instanceof Error ? err.message : t('adminSearch.queryPreviewError')
			);
			setPreview(null);
		} finally {
			setPreviewRunning(false);
		}
	}, [query, simulateChatQuery, t]);

	const run = React.useCallback(async () => {
		const trimmed = query.trim();
		if (!trimmed) return;
		setRunning(true);
		setError(null);
		try {
			const payload = await postAdminSearchTest({
				query: trimmed,
				surface: surface || undefined,
				limit,
				consume_quota: consumeQuota,
				simulate_chat_query: simulateChatQuery,
				user_id: consumeQuota && userId.trim() ? userId.trim() : undefined,
			});
			setResult(payload);
		} catch (err) {
			log.error(
				'SearchTestTab',
				'test failed',
				err instanceof Error ? err : undefined
			);
			setError(
				err instanceof Error ? err.message : t('adminSearch.testRunError')
			);
			setResult(null);
		} finally {
			setRunning(false);
		}
	}, [consumeQuota, limit, query, simulateChatQuery, surface, t, userId]);

	return (
		<div className="space-y-4">
			<div className="grid gap-3 md:grid-cols-2">
				<label className="flex flex-col gap-1 md:col-span-2">
					<span className={DESKTOP_TYPOGRAPHY.caption}>
						{t('adminSearch.testQuery')}
					</span>
					<input
						type="text"
						className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={t('adminSearch.testQueryPlaceholder')}
					/>
				</label>
				<label className="flex flex-col gap-1">
					<span className={DESKTOP_TYPOGRAPHY.caption}>
						{t('adminSearch.testSurface')}
					</span>
					<select
						className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
						value={surface}
						onChange={(e) =>
							setSurface(e.target.value as SearchSurfaceKey | '')
						}
					>
						{SURFACES.map((s) => (
							<option key={s} value={s}>
								{s}
							</option>
						))}
					</select>
				</label>
				<label className="flex flex-col gap-1">
					<span className={DESKTOP_TYPOGRAPHY.caption}>
						{t('adminSearch.testLimit')}
					</span>
					<input
						type="number"
						min={1}
						max={20}
						className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
						value={limit}
						onChange={(e) => setLimit(Number(e.target.value) || 8)}
					/>
				</label>
			</div>

			<div className="flex flex-wrap gap-4 text-sm text-white/90">
				<label className="inline-flex items-center gap-2">
					<input
						type="checkbox"
						checked={simulateChatQuery}
						onChange={(e) => setSimulateChatQuery(e.target.checked)}
					/>
					{t('adminSearch.simulateChatQuery')}
				</label>
				<label className="inline-flex items-center gap-2">
					<input
						type="checkbox"
						checked={consumeQuota}
						onChange={(e) => setConsumeQuota(e.target.checked)}
					/>
					{t('adminSearch.consumeQuota')}
				</label>
			</div>

			{consumeQuota ? (
				<label className="flex flex-col gap-1">
					<span className={DESKTOP_TYPOGRAPHY.caption}>
						{t('adminSearch.testUserId')}
					</span>
					<input
						type="text"
						className="max-w-md rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
						value={userId}
						onChange={(e) => setUserId(e.target.value)}
						placeholder="UUID"
					/>
				</label>
			) : null}

			<div className="flex flex-wrap gap-2">
				{PRESET_QUERIES.map((preset) => (
					<button
						key={preset}
						type="button"
						className={`${DESKTOP_INTERACTIVE.btnRounded} border border-white/10 px-2 py-1 text-xs text-slate-300`}
						onClick={() => setQuery(preset)}
					>
						{preset}
					</button>
				))}
			</div>

			<div className="rounded-lg border border-white/10 bg-black/20 p-4">
				<p className={`${DESKTOP_TYPOGRAPHY.caption} mb-2`}>
					{t('adminSearch.queryPreviewTitle')}
				</p>
				<button
					type="button"
					disabled={previewRunning || !query.trim()}
					onClick={() => void runPreview()}
					className={`${DESKTOP_INTERACTIVE.btnRounded} inline-flex items-center gap-2 border border-white/10 px-3 py-1.5 text-sm text-slate-200 disabled:opacity-50`}
				>
					{previewRunning
						? t('adminSearch.queryPreviewRunning')
						: t('adminSearch.queryPreviewRun')}
				</button>
				{previewError ? (
					<p className={`mt-2 ${DESKTOP_TYPOGRAPHY.body} text-red-300`}>
						{previewError}
					</p>
				) : null}
				{preview ? (
					<div className={`mt-3 ${DESKTOP_TYPOGRAPHY.meta} text-slate-300`}>
						<p>
							{t('adminSearch.queryPreviewOriginal')}: {preview.query_original}
						</p>
						<p className="mt-1">
							{t('adminSearch.queryPreviewEffective')}:{' '}
							{preview.query_effective}
						</p>
					</div>
				) : null}
			</div>

			<button
				type="button"
				disabled={running || !query.trim()}
				onClick={() => void run()}
				className={`${DESKTOP_INTERACTIVE.btnRounded} inline-flex items-center gap-2 bg-violet-600/90 px-4 py-2 text-sm text-white disabled:opacity-50`}
			>
				<PlayIcon className="h-4 w-4" />
				{running ? t('adminSearch.testRunning') : t('adminSearch.testRun')}
			</button>

			{error ? (
				<p className={`${DESKTOP_TYPOGRAPHY.body} text-red-300`}>{error}</p>
			) : null}

			{result ? (
				<div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
					<div className={`${DESKTOP_TYPOGRAPHY.meta} text-slate-300`}>
						<p>
							{t('adminSearch.testStatus')}:{' '}
							<span className="text-white">{result.status}</span>
							{' · '}
							{t('adminSearch.testProvider')}: {result.provider ?? '—'}
							{' · '}
							{result.latency_ms} ms
						</p>
						<p className="mt-1">
							{t('adminSearch.testEffectiveQuery')}: {result.query_effective}
						</p>
						{result.blockers.length ? (
							<p className="mt-1 text-amber-200">
								{t('adminSearch.colBlockers')}: {result.blockers.join(', ')}
							</p>
						) : null}
					</div>

					{result.hits.length ? (
						<div className="overflow-auto rounded border border-white/10">
							<table className="min-w-full text-left text-sm">
								<thead className="bg-white/[0.04] text-xs uppercase text-slate-400">
									<tr>
										<th className="px-3 py-2">#</th>
										<th className="px-3 py-2">{t('adminSearch.colTitle')}</th>
										<th className="px-3 py-2">{t('adminSearch.colSnippet')}</th>
										<th className="px-3 py-2">URL</th>
									</tr>
								</thead>
								<tbody>
									{result.hits.map((hit) => (
										<tr
											key={`${hit.url}|${hit.title}`}
											className="border-t border-white/5"
										>
											<td className="px-3 py-2 text-slate-400">
												{result.hits.indexOf(hit) + 1}
											</td>
											<td className="px-3 py-2">{hit.title}</td>
											<td className="max-w-xs px-3 py-2 text-slate-400">
												{hit.content.slice(0, 200)}
											</td>
											<td className="px-3 py-2">
												{hit.url ? (
													<a
														href={hit.url}
														target="_blank"
														rel="noopener noreferrer"
														className="text-violet-300 hover:underline"
													>
														{hit.url.slice(0, 60)}
													</a>
												) : (
													'—'
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : (
						<p className={DESKTOP_TYPOGRAPHY.meta}>
							{t('adminSearch.testNoHits')}
						</p>
					)}

					{result.prompt_preview ? (
						<div>
							<p className={`${DESKTOP_TYPOGRAPHY.caption} mb-2`}>
								{t('adminSearch.promptPreview')}
							</p>
							<pre className="max-h-64 overflow-auto rounded border border-white/10 bg-black/40 p-3 text-xs text-slate-300 whitespace-pre-wrap">
								{result.prompt_preview}
							</pre>
						</div>
					) : null}
				</div>
			) : null}
		</div>
	);
}
