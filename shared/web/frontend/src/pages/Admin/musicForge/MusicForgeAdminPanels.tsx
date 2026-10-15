/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * MusicForge Admin tab panels (overview, runs, feedback, config, probe).
 *
 * Invariants:
 * - Envelope-only admin API; no bare-array dual-accept.
 * - Does not import DESKTOP_* (Wave 3 residual).
 *
 * Related:
 * - `pages/Admin/musicForge/MusicForgeAdminSection.tsx`
 * - `pages/Admin/musicForge/musicForgeAdminApi.ts`
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { log } from '../../../utils/logger';
import { AdminButton, OpsProbePanel } from '../ui';
import { adminUiMetaClass } from './musicForgeConfigEditorShared';
import { MusicForgeConfigEditor } from './MusicForgeConfigEditor';
import { MusicForgeAdminRunsPanel } from './MusicForgeAdminRunsPanel';
import {
	type MusicForgeAdminFeedbackStats,
	type MusicForgeAdminOverviewStats,
	type MusicForgeComfyProbeResponse,
	type MusicForgeConfigRevisionRow,
	activateMusicForgeAdminConfigRevision,
	createMusicForgeAdminConfigDraft,
	getMusicForgeAdminComfyProbe,
	getMusicForgeAdminConfigRevisions,
	getMusicForgeAdminFeedbackStats,
	getMusicForgeAdminOverviewStats,
} from './musicForgeAdminApi';

function statusBadgeClass(ok: boolean): string {
	return ok
		? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
		: 'border-red-500/40 bg-red-500/10 text-red-200';
}

function StatCard({
	label,
	value,
}: {
	label: string;
	value: React.ReactNode;
}): React.ReactElement {
	return (
		<div className="rounded-xl border border-white/10 bg-white/3 p-4">
			<div className={adminUiMetaClass}>{label}</div>
			<div className="mt-1 text-lg font-medium text-white">{value}</div>
		</div>
	);
}

function sumCounts(counts: Record<string, number> | undefined): number {
	if (!counts) return 0;
	return Object.values(counts).reduce((acc, n) => acc + (Number(n) || 0), 0);
}

export function OverviewPanel(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [stats, setStats] = React.useState<MusicForgeAdminOverviewStats | null>(
		null
	);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const load = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			setStats(await getMusicForgeAdminOverviewStats());
		} catch (err) {
			log.error(
				'MusicForgeAdminOverview',
				'stats load failed',
				err instanceof Error ? err : undefined
			);
			setError(t('adminMusicForge.loadError'));
		} finally {
			setLoading(false);
		}
	}, [t]);

	React.useEffect(() => {
		void load();
	}, [load]);

	const windowTotal = sumCounts(stats?.counts_by_status);
	const running = stats?.counts_by_status?.running ?? 0;
	const failed = stats?.counts_by_status?.failed ?? 0;
	const topFail = stats?.fail_by_stage?.[0];

	return (
		<div className="space-y-4">
			<div className="rounded-md border border-white/10 bg-black/20 p-3 space-y-2">
				<p className="text-sm font-medium text-white/90">
					{t('adminMusicForge.overviewGuideTitle')}
				</p>
				<p className={`text-sm ${adminUiMetaClass}`}>
					{t('adminMusicForge.overviewGuideBody')}
				</p>
				<ul className={`list-disc space-y-1 pl-5 text-sm ${adminUiMetaClass}`}>
					<li>{t('adminMusicForge.overviewGuideModes')}</li>
					<li>{t('adminMusicForge.overviewGuideLanes')}</li>
					<li>{t('adminMusicForge.overviewGuideNotInForge')}</li>
				</ul>
			</div>
			<div className="flex justify-end">
				<AdminButton
					variant="secondary"
					onClick={() => void load()}
					disabled={loading}
				>
					<ArrowPathIcon className="h-4 w-4" />
					{t('adminMusicForge.refresh')}
				</AdminButton>
			</div>
			{error ? (
				<p className="text-sm text-red-300">{error}</p>
			) : loading && !stats ? (
				<p className={adminUiMetaClass}>{t('adminMusicForge.loading')}</p>
			) : stats ? (
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					<StatCard
						label={t('adminMusicForge.overviewWindowHours', {
							hours: stats.window_hours,
						})}
						value={windowTotal}
					/>
					<StatCard
						label={t('adminMusicForge.overviewRunning')}
						value={running}
					/>
					<StatCard
						label={t('adminMusicForge.overviewFailed24h')}
						value={failed}
					/>
					<StatCard
						label={t('adminMusicForge.overviewFeedbackLike')}
						value={stats.feedback_like}
					/>
					<StatCard
						label={t('adminMusicForge.overviewFeedbackDislike')}
						value={stats.feedback_dislike}
					/>
					<StatCard
						label={t('adminMusicForge.overviewTopFailStage')}
						value={
							topFail
								? `${topFail.stage} (${topFail.count})`
								: t('adminMusicForge.overviewNoFailStage')
						}
					/>
				</div>
			) : null}
		</div>
	);
}

export function RunsPanel(): React.ReactElement {
	return <MusicForgeAdminRunsPanel />;
}

export function FeedbackPanel(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [stats, setStats] = React.useState<MusicForgeAdminFeedbackStats | null>(
		null
	);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const load = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			setStats(await getMusicForgeAdminFeedbackStats());
		} catch (err) {
			log.error(
				'MusicForgeAdminFeedback',
				'feedback stats load failed',
				err instanceof Error ? err : undefined
			);
			setError(t('adminMusicForge.loadError'));
		} finally {
			setLoading(false);
		}
	}, [t]);

	React.useEffect(() => {
		void load();
	}, [load]);

	const likes = stats?.rating_histogram?.like ?? 0;
	const dislikes = stats?.rating_histogram?.dislike ?? 0;
	const total = sumCounts(stats?.rating_histogram);
	const topReasons = stats?.top_reason_codes ?? [];

	return (
		<div className="space-y-4">
			<div className="flex justify-end">
				<AdminButton
					variant="secondary"
					onClick={() => void load()}
					disabled={loading}
				>
					<ArrowPathIcon className="h-4 w-4" />
					{t('adminMusicForge.refresh')}
				</AdminButton>
			</div>
			{error ? <p className="text-sm text-red-300">{error}</p> : null}
			{loading && !stats ? (
				<p className={adminUiMetaClass}>{t('adminMusicForge.loading')}</p>
			) : stats ? (
				<>
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
						<StatCard
							label={t('adminMusicForge.feedbackTotal')}
							value={total}
						/>
						<StatCard
							label={t('adminMusicForge.feedbackLikes')}
							value={likes}
						/>
						<StatCard
							label={t('adminMusicForge.feedbackDislikes')}
							value={dislikes}
						/>
					</div>
					{topReasons.length > 0 ? (
						<div className="overflow-x-auto rounded-xl border border-white/10">
							<table className="min-w-full text-left text-sm">
								<thead className="border-b border-white/10 bg-white/3 text-slate-300">
									<tr>
										<th className="px-3 py-2">
											{t('adminMusicForge.feedbackReason')}
										</th>
										<th className="px-3 py-2">
											{t('adminMusicForge.feedbackReasonCount')}
										</th>
									</tr>
								</thead>
								<tbody>
									{topReasons.map((row) => (
										<tr
											key={row.reason_code}
											className="border-b border-white/5"
										>
											<td className="px-3 py-2 text-slate-100">
												{row.reason_code}
											</td>
											<td className="px-3 py-2 text-slate-300">{row.count}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : null}
				</>
			) : null}
		</div>
	);
}

export function ConfigPanel(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [rows, setRows] = React.useState<MusicForgeConfigRevisionRow[]>([]);
	const [loading, setLoading] = React.useState(false);
	const [activatingId, setActivatingId] = React.useState<string | null>(null);
	const [creatingDraft, setCreatingDraft] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [message, setMessage] = React.useState<string | null>(null);
	const [editingRevisionId, setEditingRevisionId] = React.useState<
		string | null
	>(null);

	const load = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await getMusicForgeAdminConfigRevisions();
			setRows(response.items);
		} catch (err) {
			log.error(
				'MusicForgeAdminConfig',
				'revisions load failed',
				err instanceof Error ? err : undefined
			);
			setError(t('adminMusicForge.loadError'));
			setRows([]);
		} finally {
			setLoading(false);
		}
	}, [t]);

	React.useEffect(() => {
		void load();
	}, [load]);

	const activate = async (revisionId: string) => {
		setActivatingId(revisionId);
		setError(null);
		setMessage(null);
		try {
			const result = await activateMusicForgeAdminConfigRevision(revisionId);
			setMessage(
				t('adminMusicForge.configActivatedSuccess', { version: result.version })
			);
			await load();
		} catch (err) {
			log.error(
				'MusicForgeAdminConfig',
				'activate failed',
				err instanceof Error ? err : undefined
			);
			setError(t('adminMusicForge.configActivateError'));
		} finally {
			setActivatingId(null);
		}
	};

	const createDraft = async () => {
		setCreatingDraft(true);
		setError(null);
		setMessage(null);
		try {
			const draft = await createMusicForgeAdminConfigDraft();
			setMessage(
				t('adminMusicForge.configDraftCreatedSuccess', {
					version: draft.version,
				})
			);
			await load();
			setEditingRevisionId(draft.id);
		} catch (err) {
			const detail =
				err instanceof Error
					? err.message
					: t('adminMusicForge.configDraftCreateError');
			log.error(
				'MusicForgeAdminConfig',
				'create draft failed',
				err instanceof Error ? err : undefined
			);
			setError(detail);
		} finally {
			setCreatingDraft(false);
		}
	};

	if (editingRevisionId) {
		return (
			<MusicForgeConfigEditor
				revisionId={editingRevisionId}
				onClose={() => setEditingRevisionId(null)}
				onSaved={() => void load()}
			/>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap justify-end gap-2">
				<AdminButton
					variant="primary"
					onClick={() => void createDraft()}
					disabled={creatingDraft || loading}
				>
					{creatingDraft
						? t('adminMusicForge.configDraftCreating')
						: t('adminMusicForge.configCreateDraft')}
				</AdminButton>
				<AdminButton
					variant="secondary"
					onClick={() => void load()}
					disabled={loading}
				>
					<ArrowPathIcon className="h-4 w-4" />
					{t('adminMusicForge.refresh')}
				</AdminButton>
			</div>
			{error ? <p className="text-sm text-red-300">{error}</p> : null}
			{message ? <p className="text-sm text-emerald-300">{message}</p> : null}
			{loading && rows.length === 0 ? (
				<p className={adminUiMetaClass}>{t('adminMusicForge.loading')}</p>
			) : null}
			{rows.length === 0 && !loading && !error ? (
				<p className={adminUiMetaClass}>{t('adminMusicForge.configEmpty')}</p>
			) : null}
			{rows.length > 0 ? (
				<div className="overflow-x-auto rounded-xl border border-white/10">
					<table className="min-w-full text-left text-sm">
						<thead className="border-b border-white/10 bg-white/3 text-slate-300">
							<tr>
								<th className="px-3 py-2">
									{t('adminMusicForge.configVersion')}
								</th>
								<th className="px-3 py-2">
									{t('adminMusicForge.configStatus')}
								</th>
								<th className="px-3 py-2">
									{t('adminMusicForge.configActivatedAt')}
								</th>
								<th className="px-3 py-2">
									{t('adminMusicForge.configAction')}
								</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => (
								<tr key={row.id} className="border-b border-white/5">
									<td className="px-3 py-2 text-slate-100">{row.version}</td>
									<td className="px-3 py-2">
										<span
											className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(row.status === 'active')}`}
										>
											{row.status}
										</span>
									</td>
									<td className="px-3 py-2 text-slate-400">
										{row.activated_at ?? '—'}
									</td>
									<td className="px-3 py-2">
										<div className="flex flex-wrap gap-2">
											<AdminButton
												variant="secondary"
												className="py-1 text-xs"
												onClick={() => setEditingRevisionId(row.id)}
											>
												{row.status === 'draft'
													? t('adminMusicForge.configEdit')
													: t('adminMusicForge.configOpen')}
											</AdminButton>
											{row.status === 'active' ? (
												<span className={adminUiMetaClass}>
													{t('adminMusicForge.configActive')}
												</span>
											) : (
												<AdminButton
													variant="primary"
													className="py-1 text-xs"
													disabled={activatingId === row.id}
													onClick={() => void activate(row.id)}
												>
													{activatingId === row.id
														? t('adminMusicForge.configActivating')
														: t('adminMusicForge.configActivate')}
												</AdminButton>
											)}
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}
		</div>
	);
}

export function ProbePanel(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [result, setResult] =
		React.useState<MusicForgeComfyProbeResponse | null>(null);
	const [running, setRunning] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const runProbe = async () => {
		setRunning(true);
		setError(null);
		try {
			setResult(await getMusicForgeAdminComfyProbe());
		} catch (err) {
			log.error(
				'MusicForgeAdminProbe',
				'probe failed',
				err instanceof Error ? err : undefined
			);
			setError(t('adminMusicForge.probeError'));
			setResult(null);
		} finally {
			setRunning(false);
		}
	};

	return (
		<div className="space-y-4">
			<OpsProbePanel
				title={t('adminMusicForge.tabs.probe')}
				description={t('adminMusicForge.probeHint')}
				runLabel={
					running
						? t('adminMusicForge.probeRunning')
						: t('adminMusicForge.probeRun')
				}
				busy={running}
				onRun={() => void runProbe()}
				lastResult={
					error
						? { ok: false, message: error }
						: result
							? {
									ok: Boolean(result.available),
									message: result.available
										? t('adminMusicForge.probeOk')
										: t('adminMusicForge.probeFail'),
									detail: (
										<pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-slate-200">
											{JSON.stringify(result, null, 2)}
										</pre>
									),
								}
							: null
				}
			/>
		</div>
	);
}
