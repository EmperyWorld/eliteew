/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Content Admin diagnostics tab: pipeline health checks, dependency probe, ES reindex, duplicates (Wave 2).
 *
 * Invariants:
 * - Diagnostics GET and probe POST are separate contracts; both stay visible.
 * - Probe UI uses New World OpsProbePanel only.
 * - Reindex-all is POST /api/v1/content/reindex-all (content admin), not Assistant KB.
 *
 * Related:
 * - `pages/Admin/contentAdminApi.ts`
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { log } from '../../../utils/logger';
import { DESKTOP_TYPOGRAPHY } from '../../Desktop/constants';
import {
	type ContentOpsDiagnosticsResponse,
	getAdminContentDuplicates,
	getAdminContentOpsDiagnostics,
	postAdminContentOpsProbe,
	postAdminContentReindexAll,
} from '../contentAdminApi';
import {
	AdminButton,
	AdminStatusBanner,
	DangerConfirmModal,
	OpsProbePanel,
} from '../ui';

function statusBadgeClass(ok: boolean): string {
	return ok
		? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
		: 'border-red-500/40 bg-red-500/10 text-red-200';
}

export function ContentDiagnosticsTab(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [result, setResult] =
		React.useState<ContentOpsDiagnosticsResponse | null>(null);
	const [running, setRunning] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [probeBusy, setProbeBusy] = React.useState(false);
	const [probeLast, setProbeLast] = React.useState<{
		ok: boolean;
		message: string;
		detail?: React.ReactNode;
	} | null>(null);
	const [reindexOpen, setReindexOpen] = React.useState(false);
	const [reindexBusy, setReindexBusy] = React.useState(false);
	const [indexOpsMessage, setIndexOpsMessage] = React.useState<string | null>(
		null
	);
	const [indexOpsError, setIndexOpsError] = React.useState<string | null>(null);
	const [duplicatesSummary, setDuplicatesSummary] = React.useState<
		string | null
	>(null);
	const [duplicatesBusy, setDuplicatesBusy] = React.useState(false);

	const runDiagnostics = React.useCallback(async () => {
		setRunning(true);
		setError(null);
		try {
			setResult(await getAdminContentOpsDiagnostics());
		} catch (err) {
			log.error(
				'ContentDiagnosticsTab',
				'diagnostics failed',
				err instanceof Error ? err : undefined
			);
			setError(
				err instanceof Error ? err.message : t('adminContent.diagnosticsError')
			);
		} finally {
			setRunning(false);
		}
	}, [t]);

	React.useEffect(() => {
		void runDiagnostics();
	}, [runDiagnostics]);

	const runProbe = React.useCallback(async () => {
		setProbeBusy(true);
		try {
			const out = await postAdminContentOpsProbe();
			const allOk = out.results.every((row) => row.ok);
			setProbeLast({
				ok: allOk,
				message: allOk
					? t('adminContent.probeOk', 'Dependency probe passed')
					: t('adminContent.probeFail', 'Dependency probe reported failures'),
				detail: (
					<ul className="mt-1 list-disc pl-4 text-xs">
						{out.results.map((row) => (
							<li key={row.target}>
								{row.target}: {row.ok ? 'ok' : 'fail'} ({row.latency_ms} ms) —{' '}
								{row.message}
							</li>
						))}
					</ul>
				),
			});
		} catch (err) {
			log.error(
				'ContentDiagnosticsTab',
				'probe failed',
				err instanceof Error ? err : undefined
			);
			setProbeLast({
				ok: false,
				message:
					err instanceof Error
						? err.message
						: t('adminContent.probeError', 'Probe request failed'),
			});
		} finally {
			setProbeBusy(false);
		}
	}, [t]);

	const runDuplicatesScan = React.useCallback(async () => {
		setDuplicatesBusy(true);
		setIndexOpsError(null);
		setDuplicatesSummary(null);
		try {
			const data = await getAdminContentDuplicates();
			const summary = data.summary ?? {};
			const exact =
				typeof summary.exact_duplicate_groups === 'number'
					? summary.exact_duplicate_groups
					: Array.isArray(data.exact_duplicates)
						? data.exact_duplicates.length
						: 0;
			const potential =
				typeof summary.potential_duplicate_groups === 'number'
					? summary.potential_duplicate_groups
					: Array.isArray(data.potential_duplicates)
						? data.potential_duplicates.length
						: 0;
			const wasted =
				typeof summary.total_wasted_space_formatted === 'string'
					? summary.total_wasted_space_formatted
					: '—';
			setDuplicatesSummary(
				t(
					'adminContent.duplicatesSummary',
					'Exact groups: {{exact}}; potential: {{potential}}; wasted: {{wasted}}',
					{ exact, potential, wasted }
				)
			);
		} catch (err) {
			log.error(
				'ContentDiagnosticsTab',
				'Duplicates scan failed',
				err instanceof Error ? err : undefined
			);
			setIndexOpsError(
				err instanceof Error
					? err.message
					: t('adminContent.duplicatesError', 'Duplicates scan failed')
			);
		} finally {
			setDuplicatesBusy(false);
		}
	}, [t]);

	return (
		<div className="space-y-4">
			<OpsProbePanel
				title={t('adminContent.probeTitle', 'Dependency probe')}
				description={t(
					'adminContent.probeDescription',
					'POST content-ops/probe — SeaweedFS storage and download-ticket Redis.'
				)}
				runLabel={t('adminContent.runProbe', 'Run probe')}
				busy={probeBusy}
				onRun={() => void runProbe()}
				lastResult={probeLast}
			/>

			<div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-4">
				<h3 className="text-sm font-semibold text-slate-100">
					{t('adminContent.indexOpsTitle', 'Index ops')}
				</h3>
				<p className="text-xs text-slate-400">
					{t(
						'adminContent.indexOpsHint',
						'ES reindex-all (content admin) and current-user duplicates scan. Not Assistant KB reindex.'
					)}
				</p>
				<div className="flex flex-wrap gap-2">
					<AdminButton
						variant="danger"
						disabled={reindexBusy}
						onClick={() => setReindexOpen(true)}
					>
						{t('adminContent.reindexAll', 'Reindex all → Elasticsearch')}
					</AdminButton>
					<AdminButton
						variant="secondary"
						disabled={duplicatesBusy}
						onClick={() => void runDuplicatesScan()}
					>
						{duplicatesBusy
							? t('adminContent.loading')
							: t('adminContent.scanDuplicates', 'Scan duplicates')}
					</AdminButton>
				</div>
				{indexOpsMessage ? (
					<AdminStatusBanner tone="success">
						{indexOpsMessage}
					</AdminStatusBanner>
				) : null}
				{indexOpsError ? (
					<AdminStatusBanner tone="danger">{indexOpsError}</AdminStatusBanner>
				) : null}
				{duplicatesSummary ? (
					<p className="text-sm text-slate-300">{duplicatesSummary}</p>
				) : null}
			</div>

			<div className="flex flex-wrap gap-2">
				<AdminButton
					variant="secondary"
					disabled={running}
					onClick={() => void runDiagnostics()}
				>
					<span className="inline-flex items-center gap-1">
						<ArrowPathIcon className="h-4 w-4" />
						{running
							? t('adminContent.loading')
							: t('adminContent.runDiagnostics')}
					</span>
				</AdminButton>
			</div>

			{error ? (
				<p className="text-sm text-red-300" role="alert">
					{error}
				</p>
			) : null}

			{result?.checks.length ? (
				<div className="overflow-x-auto rounded-xl border border-white/10">
					<table className="min-w-full text-sm">
						<thead className="bg-white/[0.04] text-left text-slate-400">
							<tr>
								<th className="px-3 py-2">{t('adminContent.colCheck')}</th>
								<th className="px-3 py-2">{t('adminContent.colStatus')}</th>
								<th className="px-3 py-2">{t('adminContent.colLatency')}</th>
								<th className="px-3 py-2">{t('adminContent.colMessage')}</th>
							</tr>
						</thead>
						<tbody>
							{result.checks.map((row) => (
								<tr key={row.id} className="border-t border-white/5">
									<td className="px-3 py-2 font-mono text-xs text-slate-200">
										{row.id}
									</td>
									<td className="px-3 py-2">
										<span
											className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(row.ok)}`}
										>
											{row.ok
												? t('adminContent.statusOk')
												: t('adminContent.statusFail')}
										</span>
									</td>
									<td className="px-3 py-2 text-slate-300">
										{row.latency_ms != null ? `${row.latency_ms} ms` : '—'}
									</td>
									<td className="px-3 py-2 text-slate-300">{row.message}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : !running && !error ? (
				<p className={DESKTOP_TYPOGRAPHY.meta}>{t('adminContent.noChecks')}</p>
			) : null}

			<DangerConfirmModal
				open={reindexOpen}
				title={t('adminContent.reindexTitle', 'Reindex all content')}
				description={t(
					'adminContent.reindexBody',
					'Starts background Elasticsearch reindex for all non-deleted content. Type REINDEX to confirm.'
				)}
				confirmPhrase="REINDEX"
				busy={reindexBusy}
				onCancel={() => setReindexOpen(false)}
				onConfirm={() =>
					void (async () => {
						setReindexBusy(true);
						setIndexOpsError(null);
						setIndexOpsMessage(null);
						try {
							const out = await postAdminContentReindexAll();
							setReindexOpen(false);
							setIndexOpsMessage(
								typeof out.message === 'string'
									? out.message
									: t(
											'adminContent.reindexStarted',
											'Reindex started in background'
										)
							);
						} catch (err) {
							log.error(
								'ContentDiagnosticsTab',
								'Reindex-all failed',
								err instanceof Error ? err : undefined
							);
							setIndexOpsError(
								err instanceof Error
									? err.message
									: t('adminContent.reindexError', 'Reindex failed')
							);
						} finally {
							setReindexBusy(false);
						}
					})()
				}
			/>
		</div>
	);
}
