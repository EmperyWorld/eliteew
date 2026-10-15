/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * KBSEW admin — barrel CRUD, ingestion, force-reindex, status, job monitor, revision badge.
 *
 * Invariants:
 * - Status polls while a barrel is selected; missing revision/trace → n/a.
 * - Force-reindex uses POST …/reindex (not re-upload) so completed assets re-queue.
 *
 * Related:
 * - `pages/Admin/kbsew/KbsewJobMonitor.tsx`
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '../../Desktop/constants';
import {
	createKbsewBarrel,
	deleteKbsewBarrel,
	forceReindexKbsewBarrel,
	getKbsewBarrelStatus,
	ingestKbsewDocument,
	listKbsewBarrels,
	listKbsewDrivers,
	setKbsewBarrelEnabled,
	uploadKbsewDocument,
	type KbsewBarrel,
	type KbsewBarrelStatus,
} from '../kbsewAdminApi';
import { KbsewDegradedBanner } from './KbsewDegradedBanner';
import { KbsewJobMonitor } from './KbsewJobMonitor';
import {
	canForceReindexBarrel,
	KBSEW_BARREL_STATUS_POLL_MS,
	summarizeForceReindexBarrel,
} from './kbsewBarrelsPolicy';
import { revisionLabelOrNa } from './kbsewJobFormat';

const STATUS_POLL_MS = KBSEW_BARREL_STATUS_POLL_MS;

function sortBarrels(rows: KbsewBarrel[]): KbsewBarrel[] {
	return [...rows].sort(
		(a, b) =>
			new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
	);
}

async function copyText(text: string): Promise<void> {
	if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
	}
}

export function KbsewBarrelsTab(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [barrels, setBarrels] = React.useState<KbsewBarrel[]>([]);
	const [drivers, setDrivers] = React.useState<string[]>(['pdf']);
	const [selectedId, setSelectedId] = React.useState<string | null>(null);
	const [status, setStatus] = React.useState<KbsewBarrelStatus | null>(null);
	const [listLoading, setListLoading] = React.useState(false);
	const [actionLoading, setActionLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [copyMsg, setCopyMsg] = React.useState<string | null>(null);
	const [name, setName] = React.useState('');
	const [description, setDescription] = React.useState('');
	const [driverType, setDriverType] = React.useState('pdf');
	const [sourceUrl, setSourceUrl] = React.useState('');
	const fileInputRef = React.useRef<HTMLInputElement>(null);

	const refreshList = React.useCallback(async () => {
		setListLoading(true);
		setError(null);
		try {
			const [barrelRows, driverInfo] = await Promise.all([
				listKbsewBarrels(),
				listKbsewDrivers(),
			]);
			setBarrels(sortBarrels(barrelRows));
			setDrivers(driverInfo.driver_types);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setListLoading(false);
		}
	}, []);

	const refreshStatus = React.useCallback(async (barrelId: string) => {
		try {
			const nextStatus = await getKbsewBarrelStatus(barrelId);
			setStatus(nextStatus);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setStatus(null);
		}
	}, []);

	React.useEffect(() => {
		void refreshList();
	}, [refreshList]);

	React.useEffect(() => {
		if (!selectedId) {
			setStatus(null);
			return;
		}
		void refreshStatus(selectedId);
		const timer = window.setInterval(() => {
			void refreshStatus(selectedId);
		}, STATUS_POLL_MS);
		return () => {
			window.clearInterval(timer);
		};
	}, [selectedId, refreshStatus]);

	const onCreate = async () => {
		if (!name.trim()) return;
		setActionLoading(true);
		setError(null);
		try {
			const created = await createKbsewBarrel({
				name: name.trim(),
				description: description.trim() || undefined,
				driver_type: driverType,
				enabled: true,
			});
			setName('');
			setDescription('');
			setBarrels((prev) => sortBarrels([created, ...prev]));
			setSelectedId(created.id);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setActionLoading(false);
		}
	};

	const onDelete = async (barrelId: string) => {
		setActionLoading(true);
		setError(null);
		try {
			await deleteKbsewBarrel(barrelId);
			if (selectedId === barrelId) {
				setSelectedId(null);
				setStatus(null);
			}
			setBarrels((prev) => prev.filter((row) => row.id !== barrelId));
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setActionLoading(false);
		}
	};

	const onToggle = async (barrel: KbsewBarrel) => {
		setActionLoading(true);
		setError(null);
		try {
			const updated = await setKbsewBarrelEnabled(barrel.id, !barrel.enabled);
			setBarrels((prev) =>
				prev.map((row) => (row.id === updated.id ? updated : row))
			);
			if (selectedId === barrel.id) {
				await refreshStatus(barrel.id);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setActionLoading(false);
		}
	};

	const onIngest = async () => {
		if (!selectedId || !sourceUrl.trim()) return;
		setActionLoading(true);
		setError(null);
		try {
			await ingestKbsewDocument(selectedId, sourceUrl.trim());
			setSourceUrl('');
			await refreshStatus(selectedId);
			await refreshList();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setActionLoading(false);
		}
	};

	const onUploadFile = async (file: File | null) => {
		if (!selectedId || !file) return;
		setActionLoading(true);
		setError(null);
		try {
			await uploadKbsewDocument(selectedId, file);
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
			await refreshStatus(selectedId);
			await refreshList();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setActionLoading(false);
		}
	};

	const onForceReindex = async () => {
		if (!selectedId || !canForceReindexBarrel(status)) return;
		const ok = window.confirm(t('adminKbsew.reindexConfirm'));
		if (!ok) return;
		setActionLoading(true);
		setError(null);
		try {
			const result = await forceReindexKbsewBarrel(selectedId);
			const summary = summarizeForceReindexBarrel(result);
			setCopyMsg(
				t('adminKbsew.reindexResult', {
					queued: summary.queued,
					skipped: summary.skipped,
					failed: summary.failed,
				})
			);
			window.setTimeout(() => setCopyMsg(null), 4000);
			await refreshStatus(selectedId);
			await refreshList();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setActionLoading(false);
		}
	};

	const onCopyId = async (barrelId: string) => {
		try {
			await copyText(barrelId);
			setCopyMsg(t('adminKbsew.barrels.copiedId'));
			window.setTimeout(() => setCopyMsg(null), 2000);
		} catch {
			setCopyMsg(t('adminKbsew.barrels.copyFailed'));
		}
	};

	const busy = listLoading || actionLoading;

	return (
		<div className="space-y-4">
			{error ? <KbsewDegradedBanner tone="error" message={error} /> : null}
			{copyMsg ? (
				<KbsewDegradedBanner tone="success" message={copyMsg} />
			) : null}

			<section className="rounded-xl border border-white/10 bg-black/20 p-4">
				<h3 className={`${DESKTOP_TYPOGRAPHY.subtitle} mb-3 text-white/90`}>
					{t('adminKbsew.createTitle')}
				</h3>
				<div className="grid gap-3 md:grid-cols-2">
					<input
						className={`${DESKTOP_INTERACTIVE.input} w-full`}
						placeholder={t('adminKbsew.namePlaceholder')}
						value={name}
						onChange={(e) => setName(e.target.value)}
					/>
					<select
						className={`${DESKTOP_INTERACTIVE.input} w-full`}
						value={driverType}
						onChange={(e) => setDriverType(e.target.value)}
					>
						{drivers.map((d) => (
							<option key={d} value={d}>
								{d}
							</option>
						))}
					</select>
					<textarea
						className={`${DESKTOP_INTERACTIVE.input} md:col-span-2 min-h-18 w-full`}
						placeholder={t('adminKbsew.descriptionPlaceholder')}
						value={description}
						onChange={(e) => setDescription(e.target.value)}
					/>
				</div>
				<button
					type="button"
					className={`${DESKTOP_INTERACTIVE.btnPrimary} mt-3 px-4 py-2 text-sm`}
					disabled={busy || !name.trim()}
					onClick={() => void onCreate()}
				>
					{t('adminKbsew.createButton')}
				</button>
			</section>

			<section className="grid gap-4 lg:grid-cols-2">
				<div className="rounded-xl border border-white/10 bg-black/20 p-4">
					<div className="mb-3 flex items-center justify-between">
						<h3 className={`${DESKTOP_TYPOGRAPHY.subtitle} text-white/90`}>
							{t('adminKbsew.barrelsTitle')}
						</h3>
						<button
							type="button"
							className={`${DESKTOP_INTERACTIVE.btnRounded} px-3 py-1 text-xs`}
							disabled={listLoading}
							onClick={() => void refreshList()}
						>
							{t('adminKbsew.refresh')}
						</button>
					</div>
					{listLoading && barrels.length === 0 ? (
						<p className="text-sm text-white/60">{t('adminKbsew.loading')}</p>
					) : barrels.length === 0 ? (
						<p className="text-sm text-white/60">{t('adminKbsew.empty')}</p>
					) : (
						<ul className="max-h-105 space-y-2 overflow-auto pr-1">
							{barrels.map((barrel) => (
								<li
									key={barrel.id}
									className={`rounded-lg border px-3 py-2 ${
										selectedId === barrel.id
											? 'border-sky-400/60 bg-sky-500/10'
											: 'border-white/10 bg-white/5'
									}`}
								>
									<button
										type="button"
										className="w-full text-left"
										onClick={() => setSelectedId(barrel.id)}
									>
										<div className="flex flex-wrap items-center gap-2">
											<span className="font-medium text-white/95">
												{barrel.name}
											</span>
											<span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-violet-100/90">
												{barrel.driver_type}
											</span>
											<span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/60">
												{t('adminKbsew.barrels.revision')}:{' '}
												{revisionLabelOrNa(barrel.revision)}
											</span>
										</div>
										<div className="mt-0.5 font-mono text-[11px] text-white/45">
											{barrel.id}
										</div>
										<div className="mt-1 text-xs text-white/60">
											{barrel.asset_count} {t('adminKbsew.assets')}
											{barrel.enabled
												? ` · ${t('adminKbsew.enabled')}`
												: ` · ${t('adminKbsew.disabled')}`}
										</div>
									</button>
									<div className="mt-2 flex flex-wrap gap-2">
										<button
											type="button"
											className={`${DESKTOP_INTERACTIVE.btnRounded} inline-flex items-center gap-1 px-2 py-1 text-xs`}
											disabled={busy}
											onClick={() => void onCopyId(barrel.id)}
										>
											<ClipboardDocumentIcon className="h-3.5 w-3.5" />
											{t('adminKbsew.barrels.copyId')}
										</button>
										<button
											type="button"
											className={`${DESKTOP_INTERACTIVE.btnRounded} px-2 py-1 text-xs`}
											disabled={busy}
											onClick={() => void onToggle(barrel)}
										>
											{barrel.enabled
												? t('adminKbsew.disable')
												: t('adminKbsew.enable')}
										</button>
										<button
											type="button"
											className={`${DESKTOP_INTERACTIVE.btnRounded} px-2 py-1 text-xs text-red-200`}
											disabled={busy}
											onClick={() => void onDelete(barrel.id)}
										>
											{t('adminKbsew.delete')}
										</button>
									</div>
								</li>
							))}
						</ul>
					)}
				</div>

				<div className="rounded-xl border border-white/10 bg-black/20 p-4">
					<h3 className={`${DESKTOP_TYPOGRAPHY.subtitle} mb-3 text-white/90`}>
						{t('adminKbsew.detailTitle')}
					</h3>
					{!selectedId || !status ? (
						<p className="text-sm text-white/60">
							{t('adminKbsew.selectBarrel')}
						</p>
					) : (
						<div className="space-y-3 text-sm">
							<div>
								<div className="flex flex-wrap items-center gap-2">
									<strong className="text-white/95">{status.name}</strong>
									<span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-violet-100/90">
										{status.driver_type}
									</span>
									<span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/60">
										{t('adminKbsew.barrels.revision')}:{' '}
										{revisionLabelOrNa(status.revision)}
									</span>
								</div>
								<div className="mt-1 font-mono text-xs text-white/50">
									{status.barrel_id}
								</div>
								<div className="text-white/60">{status.qdrant_collection}</div>
							</div>
							<div>
								{t('adminKbsew.assetCount')}: {status.asset_count}
							</div>
							<pre className="max-h-40 overflow-auto rounded-lg bg-black/40 p-2 text-xs text-white/80">
								{JSON.stringify(status.assets_by_status, null, 2)}
							</pre>
							<button
								type="button"
								className={`${DESKTOP_INTERACTIVE.btnRounded} px-3 py-1.5 text-xs`}
								disabled={busy || status.asset_count < 1}
								onClick={() => void onForceReindex()}
							>
								{t('adminKbsew.reindexButton')}
							</button>
							<p className="text-xs text-white/50">
								{t('adminKbsew.reindexHint')}
							</p>
							<KbsewJobMonitor
								status={status}
								onCopyFeedback={(ok) => {
									setCopyMsg(
										ok
											? t('adminKbsew.jobs.copiedTrace')
											: t('adminKbsew.jobs.copyTraceFailed')
									);
									window.setTimeout(() => setCopyMsg(null), 2000);
								}}
							/>
							<input
								className={`${DESKTOP_INTERACTIVE.input} w-full`}
								placeholder={t('adminKbsew.sourceUrlPlaceholder')}
								value={sourceUrl}
								onChange={(e) => setSourceUrl(e.target.value)}
							/>
							<button
								type="button"
								className={`${DESKTOP_INTERACTIVE.btnPrimary} px-4 py-2 text-sm`}
								disabled={busy || !sourceUrl.trim()}
								onClick={() => void onIngest()}
							>
								{t('adminKbsew.ingestButton')}
							</button>
							<div className="border-t border-white/10 pt-3">
								<p className="mb-2 text-xs text-white/60">
									{t('adminKbsew.uploadHint')}
								</p>
								<input
									ref={fileInputRef}
									type="file"
									accept=".pdf,application/pdf"
									className="block w-full text-white/80 file:mr-3 file:rounded file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm"
									disabled={busy}
									onChange={(e) => {
										const file = e.target.files?.[0] ?? null;
										void onUploadFile(file);
									}}
								/>
							</div>
						</div>
					)}
				</div>
			</section>
		</div>
	);
}
