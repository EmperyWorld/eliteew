/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Content Admin storage remediation tab: scan missing blobs, migrate BYTEA, hard purge.
 *
 * Invariants:
 * - Mutating runs require explicit confirm when dry-run is off.
 *
 * Related:
 * - `pages/Admin/contentAdminApi.ts`
 * - documentation/product/CONTENT-MANAGER.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { log } from '../../../utils/logger';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '../../Desktop/constants';
import {
	type ContentStorageHardPurgeResponse,
	type ContentStorageMigrateResponse,
	type ContentStorageScanMissingResponse,
	postAdminContentOpsHardPurgeSoftDeleted,
	postAdminContentOpsMigratePgBlobs,
	postAdminContentOpsScanMissingBlobs,
} from '../contentAdminApi';

type StorageOpKind = 'scan' | 'migrate' | 'purge';

interface SharedOpForm {
	dryRun: boolean;
	limit: string;
	onlyContentId: string;
	olderThanDays: string;
}

const DEFAULT_FORM: SharedOpForm = {
	dryRun: true,
	limit: '500',
	onlyContentId: '',
	olderThanDays: '',
};

function parseLimit(raw: string): number {
	const n = Number.parseInt(raw.trim(), 10);
	if (!Number.isFinite(n) || n < 1) return 500;
	return Math.min(n, 10_000);
}

function parseOptionalDays(raw: string): number | undefined {
	const trimmed = raw.trim();
	if (!trimmed) return undefined;
	const n = Number.parseInt(trimmed, 10);
	if (!Number.isFinite(n) || n < 1) return undefined;
	return Math.min(n, 3650);
}

function formatResultSummary(
	kind: StorageOpKind,
	result:
		| ContentStorageScanMissingResponse
		| ContentStorageMigrateResponse
		| ContentStorageHardPurgeResponse
): string {
	if (kind === 'scan') {
		const r = result as ContentStorageScanMissingResponse;
		return `scanned=${r.scanned} missing=${r.missing_count} quarantined=${r.quarantined_ids.length}`;
	}
	if (kind === 'migrate') {
		const r = result as ContentStorageMigrateResponse;
		return `scanned=${r.scanned} migrated=${r.migrated} skipped=${r.skipped} failed=${r.failed}`;
	}
	const r = result as ContentStorageHardPurgeResponse;
	return `scanned=${r.scanned} purged=${r.purged} skipped=${r.skipped} failed=${r.failed} days=${r.older_than_days}`;
}

export function ContentStorageOpsTab(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [form, setForm] = React.useState<SharedOpForm>(DEFAULT_FORM);
	const [busyKind, setBusyKind] = React.useState<StorageOpKind | null>(null);
	const [error, setError] = React.useState<string | null>(null);
	const [lastResult, setLastResult] = React.useState<{
		kind: StorageOpKind;
		dryRun: boolean;
		summary: string;
	} | null>(null);

	const patchForm = React.useCallback((patch: Partial<SharedOpForm>) => {
		setForm((prev) => ({ ...prev, ...patch }));
	}, []);

	const runOp = React.useCallback(
		async (kind: StorageOpKind) => {
			if (!form.dryRun) {
				const confirmKey =
					kind === 'scan'
						? 'adminContent.storageOpsConfirmScan'
						: kind === 'migrate'
							? 'adminContent.storageOpsConfirmMigrate'
							: 'adminContent.storageOpsConfirmPurge';
				if (!window.confirm(t(confirmKey))) return;
			}

			setBusyKind(kind);
			setError(null);
			const limit = parseLimit(form.limit);
			const onlyContentId = form.onlyContentId.trim() || undefined;
			const olderThanDays = parseOptionalDays(form.olderThanDays);

			try {
				let payload:
					| ContentStorageScanMissingResponse
					| ContentStorageMigrateResponse
					| ContentStorageHardPurgeResponse;

				if (kind === 'scan') {
					payload = await postAdminContentOpsScanMissingBlobs({
						dryRun: form.dryRun,
						limit,
						onlyContentId,
					});
				} else if (kind === 'migrate') {
					payload = await postAdminContentOpsMigratePgBlobs({
						dryRun: form.dryRun,
						limit,
						onlyContentId,
					});
				} else {
					payload = await postAdminContentOpsHardPurgeSoftDeleted({
						dryRun: form.dryRun,
						limit,
						onlyContentId,
						olderThanDays,
					});
				}

				setLastResult({
					kind,
					dryRun: form.dryRun,
					summary: formatResultSummary(kind, payload),
				});
			} catch (err) {
				log.error(
					'ContentStorageOpsTab',
					`${kind} failed`,
					err instanceof Error ? err : undefined
				);
				setError(
					err instanceof Error ? err.message : t('adminContent.storageOpsError')
				);
			} finally {
				setBusyKind(null);
			}
		},
		[form, t]
	);

	const renderAction = (
		kind: StorageOpKind,
		labelKey: string,
		variant: 'default' | 'danger' = 'default'
	) => (
		<button
			type="button"
			disabled={busyKind != null}
			onClick={() => void runOp(kind)}
			className={`${DESKTOP_INTERACTIVE.btnRounded} border px-3 py-1.5 text-sm ${
				variant === 'danger'
					? 'border-amber-500/30 bg-amber-500/10 text-amber-50 hover:bg-amber-500/20'
					: 'border-white/10 text-slate-100 hover:bg-white/6'
			}`}
		>
			{busyKind === kind ? t('adminContent.loading') : t(labelKey)}
		</button>
	);

	return (
		<div className="space-y-4">
			<p className={`${DESKTOP_TYPOGRAPHY.meta} max-w-3xl`}>
				{t('adminContent.storageOpsIntro')}
			</p>

			<div className="rounded-xl border border-white/10 bg-white/3 p-4">
				<h3 className="text-sm font-semibold text-white">
					{t('adminContent.storageOpsParamsTitle')}
				</h3>
				<div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<label className="flex flex-col gap-1 text-sm text-slate-300">
						<span>{t('adminContent.storageOpsLimit')}</span>
						<input
							type="number"
							min={1}
							max={10_000}
							value={form.limit}
							onChange={(e) => patchForm({ limit: e.target.value })}
							className={`${DESKTOP_INTERACTIVE.input} w-full`}
						/>
					</label>
					<label className="flex flex-col gap-1 text-sm text-slate-300 lg:col-span-2">
						<span>{t('adminContent.storageOpsContentId')}</span>
						<input
							type="text"
							value={form.onlyContentId}
							onChange={(e) => patchForm({ onlyContentId: e.target.value })}
							placeholder={t('adminContent.storageOpsContentIdPlaceholder')}
							className={`${DESKTOP_INTERACTIVE.input} w-full font-mono text-xs`}
						/>
					</label>
					<label className="flex flex-col gap-1 text-sm text-slate-300">
						<span>{t('adminContent.storageOpsOlderThanDays')}</span>
						<input
							type="number"
							min={1}
							max={3650}
							value={form.olderThanDays}
							onChange={(e) => patchForm({ olderThanDays: e.target.value })}
							placeholder={t('adminContent.storageOpsOlderThanDaysPlaceholder')}
							className={`${DESKTOP_INTERACTIVE.input} w-full`}
						/>
					</label>
					<label className="inline-flex items-center gap-2 text-sm text-slate-300 sm:col-span-4">
						<input
							type="checkbox"
							checked={form.dryRun}
							onChange={(e) => patchForm({ dryRun: e.target.checked })}
						/>
						<span>{t('adminContent.storageOpsDryRun')}</span>
					</label>
				</div>
			</div>

			{error ? (
				<p className="text-sm text-red-300" role="alert">
					{error}
				</p>
			) : null}

			{lastResult ? (
				<div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
					<p className="font-medium">
						{t('adminContent.storageOpsLastResult', {
							mode: lastResult.dryRun
								? t('adminContent.storageOpsDryRunLabel')
								: t('adminContent.storageOpsLiveLabel'),
						})}
					</p>
					<p className="mt-1 font-mono text-xs">{lastResult.summary}</p>
				</div>
			) : null}

			<div className="grid gap-3 lg:grid-cols-3">
				<div className="rounded-xl border border-white/10 bg-white/3 p-4">
					<h3 className="text-sm font-semibold text-white">
						{t('adminContent.storageOpsScanTitle')}
					</h3>
					<p className={`${DESKTOP_TYPOGRAPHY.meta} mt-2 min-h-12`}>
						{t('adminContent.storageOpsScanHint')}
					</p>
					<div className="mt-3">
						{renderAction('scan', 'adminContent.storageOpsRunScan')}
					</div>
				</div>

				<div className="rounded-xl border border-white/10 bg-white/3 p-4">
					<h3 className="text-sm font-semibold text-white">
						{t('adminContent.storageOpsMigrateTitle')}
					</h3>
					<p className={`${DESKTOP_TYPOGRAPHY.meta} mt-2 min-h-12`}>
						{t('adminContent.storageOpsMigrateHint')}
					</p>
					<div className="mt-3">
						{renderAction('migrate', 'adminContent.storageOpsRunMigrate')}
					</div>
				</div>

				<div className="rounded-xl border border-amber-500/20 bg-amber-500/4 p-4">
					<h3 className="text-sm font-semibold text-amber-50">
						{t('adminContent.storageOpsPurgeTitle')}
					</h3>
					<p
						className={`${DESKTOP_TYPOGRAPHY.meta} mt-2 min-h-12 text-amber-100/80`}
					>
						{t('adminContent.storageOpsPurgeHint')}
					</p>
					<div className="mt-3">
						{renderAction('purge', 'adminContent.storageOpsRunPurge', 'danger')}
					</div>
				</div>
			</div>
		</div>
	);
}
