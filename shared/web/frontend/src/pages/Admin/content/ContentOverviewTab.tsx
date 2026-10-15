/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Content Admin overview tab: library stats and processing summary.
 *
 * Related:
 * - `pages/Admin/contentAdminApi.ts`
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
	type ContentOpsMetaResponse,
	getAdminContentOpsMeta,
} from '../contentAdminApi';

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024)
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function statusBadgeClass(ok: boolean): string {
	return ok
		? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
		: 'border-red-500/40 bg-red-500/10 text-red-200';
}

export interface ContentOverviewTabProps {
	onOpenDiagnostics?: () => void;
	onOpenProcessingFailures?: () => void;
	onOpenStorageOps?: () => void;
}

export function ContentOverviewTab({
	onOpenDiagnostics,
	onOpenProcessingFailures,
	onOpenStorageOps,
}: ContentOverviewTabProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [meta, setMeta] = React.useState<ContentOpsMetaResponse | null>(null);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const load = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			setMeta(await getAdminContentOpsMeta());
		} catch (err) {
			log.error(
				'ContentOverviewTab',
				'meta load failed',
				err instanceof Error ? err : undefined
			);
			setError(t('adminContent.metaLoadError'));
		} finally {
			setLoading(false);
		}
	}, [t]);

	React.useEffect(() => {
		void load();
	}, [load]);

	const workersOk = meta?.workers_healthy ?? false;

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
					{t('adminContent.refresh')}
				</button>
				{onOpenDiagnostics ? (
					<button
						type="button"
						onClick={onOpenDiagnostics}
						className={`${DESKTOP_INTERACTIVE.btnRounded} border border-white/10 px-3 py-1.5 text-sm text-slate-200`}
					>
						{t('adminContent.openDiagnostics')}
					</button>
				) : null}
				{onOpenStorageOps ? (
					<button
						type="button"
						onClick={onOpenStorageOps}
						className={`${DESKTOP_INTERACTIVE.btnRounded} border border-white/10 px-3 py-1.5 text-sm text-slate-200`}
					>
						{t('adminContent.openStorageOps')}
					</button>
				) : null}
				{onOpenProcessingFailures && (meta?.processing_failed ?? 0) > 0 ? (
					<button
						type="button"
						onClick={onOpenProcessingFailures}
						className={`${DESKTOP_INTERACTIVE.btnRounded} border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-100`}
					>
						{t('adminContent.openProcessingFailures')}
					</button>
				) : null}
			</div>

			{error ? (
				<p className="text-sm text-red-300" role="alert">
					{error}
				</p>
			) : null}

			{loading && !meta ? (
				<p className={DESKTOP_TYPOGRAPHY.meta}>{t('adminContent.loading')}</p>
			) : null}

			{meta ? (
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					<div className="rounded-xl border border-white/10 bg-white/3 p-4">
						<p className={DESKTOP_TYPOGRAPHY.caption}>
							{t('adminContent.cardTotalFiles')}
						</p>
						<p className="mt-1 text-2xl font-semibold text-white">
							{meta.total_content_rows.toLocaleString()}
						</p>
					</div>
					<div className="rounded-xl border border-white/10 bg-white/3 p-4">
						<p className={DESKTOP_TYPOGRAPHY.caption}>
							{t('adminContent.cardStorage')}
						</p>
						<p className="mt-1 text-2xl font-semibold text-white">
							{formatBytes(meta.total_storage_bytes)}
						</p>
					</div>
					<div className="rounded-xl border border-white/10 bg-white/3 p-4">
						<p className={DESKTOP_TYPOGRAPHY.caption}>
							{t('adminContent.cardWorkers')}
						</p>
						<p className="mt-2">
							<span
								className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(workersOk)}`}
							>
								{workersOk
									? t('adminContent.workersHealthy')
									: t('adminContent.workersDegraded')}
							</span>
						</p>
					</div>
					<div className="rounded-xl border border-white/10 bg-white/3 p-4">
						<p className={DESKTOP_TYPOGRAPHY.caption}>
							{t('adminContent.cardProcessingPending')}
						</p>
						<p className="mt-1 text-2xl font-semibold text-white">
							{meta.processing_pending.toLocaleString()}
						</p>
					</div>
					<div className="rounded-xl border border-white/10 bg-white/3 p-4">
						<p className={DESKTOP_TYPOGRAPHY.caption}>
							{t('adminContent.cardProcessingFailed')}
						</p>
						<p className="mt-1 text-2xl font-semibold text-white">
							{meta.processing_failed.toLocaleString()}
						</p>
					</div>
				</div>
			) : null}
		</div>
	);
}
