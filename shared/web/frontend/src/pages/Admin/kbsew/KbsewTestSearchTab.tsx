/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * KBSEW admin — operator test query against semantic search API.
 *
 * Invariants:
 * - Local retrieval_mode is sent on Test search; gateway applies body override over admin settings.
 * - `limit` follows clamped `chunks_per_barrel` (canon default 5, max 20).
 *
 * Related:
 * - `pages/Admin/kbsew/kbsewSearchSettings.ts`
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '../../Desktop/constants';
import {
	getDesktopAiChatDefaults,
	kbsewSemanticSearch,
	listKbsewBarrels,
	type KbsewBarrel,
	type KbsewRetrievalMode,
} from '../kbsewAdminApi';
import { KbsewDegradedBanner } from './KbsewDegradedBanner';
import {
	KBSEW_CHUNKS_PER_BARREL_DEFAULT,
	KBSEW_RETRIEVAL_MODE_DEFAULT,
	readKbsewSettingsFromDefaults,
} from './kbsewSearchSettings';

export function KbsewTestSearchTab(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [barrels, setBarrels] = React.useState<KbsewBarrel[]>([]);
	const [barrelId, setBarrelId] = React.useState('');
	const [query, setQuery] = React.useState('');
	const [chunks, setChunks] = React.useState<string[]>([]);
	const [retrievalMode, setRetrievalMode] = React.useState<KbsewRetrievalMode>(
		KBSEW_RETRIEVAL_MODE_DEFAULT
	);
	/** Canon default 5; loaded from agent-access `chunks_per_barrel` (clamped 1–20). */
	const [chunksPerBarrel, setChunksPerBarrel] = React.useState(
		KBSEW_CHUNKS_PER_BARREL_DEFAULT
	);
	const [loading, setLoading] = React.useState(false);
	const [listLoading, setListLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [ranEmpty, setRanEmpty] = React.useState(false);

	React.useEffect(() => {
		let cancelled = false;
		(async () => {
			setListLoading(true);
			try {
				const [rows, defaults] = await Promise.all([
					listKbsewBarrels(),
					getDesktopAiChatDefaults().catch(() => ({})),
				]);
				if (!cancelled) {
					setBarrels(rows);
					if (rows[0]?.id) {
						setBarrelId(rows[0].id);
					}
					const form = readKbsewSettingsFromDefaults(defaults);
					setRetrievalMode(form.retrievalMode);
					setChunksPerBarrel(form.chunksPerBarrel);
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : String(err));
				}
			} finally {
				if (!cancelled) setListLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const runSearch = async () => {
		if (!query.trim() || !barrelId) return;
		setLoading(true);
		setError(null);
		setChunks([]);
		setRanEmpty(false);
		try {
			const res = await kbsewSemanticSearch(query.trim(), barrelId, {
				limit: chunksPerBarrel,
				retrievalMode,
			});
			const next = res.chunks ?? [];
			setChunks(next);
			setRanEmpty(next.length === 0);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="max-w-3xl space-y-4">
			<p className={`${DESKTOP_TYPOGRAPHY.body} text-white/70`}>
				{t('adminKbsew.testSearch.description')}
			</p>

			{error ? <KbsewDegradedBanner tone="error" message={error} /> : null}

			<section className="rounded-xl border border-white/10 bg-black/25 p-4 space-y-3">
				<label className="block">
					<span className={`${DESKTOP_TYPOGRAPHY.caption} text-white/60`}>
						{t('adminKbsew.testSearch.barrelLabel')}
					</span>
					<select
						className={`${DESKTOP_INTERACTIVE.input} mt-1 w-full`}
						value={barrelId}
						disabled={listLoading || barrels.length === 0}
						onChange={(e) => setBarrelId(e.target.value)}
					>
						{barrels.length === 0 ? (
							<option value="">{t('adminKbsew.testSearch.noBarrels')}</option>
						) : null}
						{barrels.map((b) => (
							<option key={b.id} value={b.id}>
								{b.name} ({b.asset_count} {t('adminKbsew.assets')})
							</option>
						))}
					</select>
				</label>

				<label className="block">
					<span className={`${DESKTOP_TYPOGRAPHY.caption} text-white/60`}>
						{t('adminKbsew.testSearch.queryLabel')}
					</span>
					<input
						className={`${DESKTOP_INTERACTIVE.input} mt-1 w-full`}
						value={query}
						placeholder={t('adminKbsew.testSearch.queryPlaceholder')}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') void runSearch();
						}}
					/>
				</label>

				<label className="block">
					<span className={`${DESKTOP_TYPOGRAPHY.caption} text-white/60`}>
						{t('adminKbsew.testSearch.retrievalModeLabel')}
					</span>
					<select
						className={`${DESKTOP_INTERACTIVE.input} mt-1 w-full sm:max-w-xs`}
						value={retrievalMode}
						disabled={loading}
						onChange={(e) => {
							const next = e.target.value as KbsewRetrievalMode;
							setRetrievalMode(next === 'hybrid' ? 'hybrid' : 'dense');
						}}
					>
						<option value="dense">
							{t('adminKbsew.agentAccess.retrievalModeDense')}
						</option>
						<option value="hybrid">
							{t('adminKbsew.agentAccess.retrievalModeHybrid')}
						</option>
					</select>
					<span className="mt-1 block text-xs text-white/55">
						{t('adminKbsew.testSearch.retrievalModeHint')}
					</span>
				</label>

				<button
					type="button"
					className={`${DESKTOP_INTERACTIVE.btnPrimary} inline-flex items-center gap-2 px-4 py-2 text-sm`}
					disabled={loading || listLoading || !query.trim() || !barrelId}
					onClick={() => void runSearch()}
				>
					<MagnifyingGlassIcon className="h-4 w-4" />
					{loading
						? t('adminKbsew.testSearch.running')
						: t('adminKbsew.testSearch.run')}
				</button>
			</section>

			{chunks.length > 0 ? (
				<section className="rounded-xl border border-white/10 bg-black/20 p-4">
					<h3 className={`${DESKTOP_TYPOGRAPHY.subtitle} mb-3 text-white/90`}>
						{t('adminKbsew.testSearch.resultsTitle', { count: chunks.length })}
					</h3>
					<ol className="space-y-3">
						{chunks.map((chunk, chunkIndex) => (
							<li
								key={`${chunk.length}:${chunk.slice(0, 48)}`}
								className="rounded-lg border border-white/10 bg-black/30 p-3"
							>
								<div
									className={`${DESKTOP_TYPOGRAPHY.caption} mb-2 text-violet-300/80`}
								>
									{t('adminKbsew.testSearch.chunkLabel', {
										index: chunkIndex + 1,
									})}
								</div>
								<pre className="whitespace-pre-wrap text-xs text-white/85">
									{chunk}
								</pre>
							</li>
						))}
					</ol>
				</section>
			) : null}

			{!loading && ranEmpty && !error ? (
				<p className="text-sm text-white/60">
					{t('adminKbsew.testSearch.noResults')}
				</p>
			) : null}
		</div>
	);
}
