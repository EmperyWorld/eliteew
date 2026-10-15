/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin soft-revoke denylist SoT + publish to OTA denylist.json (Wave B / O4).
 *
 * Invariants:
 * - Soft revoke ≠ hard license revoke; publish writes signed denylist under updates out.
 * - Missing signing key / updates out is shown honestly (API 503).
 *
 * Related:
 * - pages/Admin/platformOps/platformOpsApi.ts
 * - documentation/platform/docker-re_doc/ADMIN-PLATFORM-OPS.md
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1
 */

import * as React from 'react';
import type { TFunction } from 'i18next';
import { DESKTOP_INTERACTIVE } from '../../../Desktop/constants';
import {
	addPlatformOpsDenylistEntry,
	getPlatformOpsDenylistStatus,
	publishPlatformOpsDenylist,
	removePlatformOpsDenylistEntry,
	type PlatformOpsDenylistStatus,
} from '../platformOpsApi';
import { PLATFORM_OPS_PANEL } from '../platformOpsPanelChrome';

export function SoftRevokeDenylistPanel({
	t,
	busy,
	setBusy,
	setError,
}: {
	t: TFunction;
	busy: boolean;
	setBusy: (v: boolean) => void;
	setError: (v: string | null) => void;
}): React.ReactElement {
	const [status, setStatus] = React.useState<PlatformOpsDenylistStatus | null>(
		null
	);
	const [loading, setLoading] = React.useState(false);
	const [licenseId, setLicenseId] = React.useState('');
	const [reason, setReason] = React.useState('');
	const [publishNote, setPublishNote] = React.useState('');
	const [lastPublishMsg, setLastPublishMsg] = React.useState<string | null>(
		null
	);

	const refresh = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			setStatus(await getPlatformOpsDenylistStatus());
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [setError]);

	React.useEffect(() => {
		void refresh();
	}, [refresh]);

	const onAdd = React.useCallback(async () => {
		const id = licenseId.trim();
		if (!id) {
			setError(t('adminPlatformOps.denylist.licenseIdRequired'));
			return;
		}
		setBusy(true);
		setError(null);
		try {
			await addPlatformOpsDenylistEntry({
				license_id: id,
				reason: reason.trim() || null,
			});
			setLicenseId('');
			setReason('');
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}, [licenseId, reason, refresh, setBusy, setError, t]);

	const onRemove = React.useCallback(
		async (id: string) => {
			if (!window.confirm(t('adminPlatformOps.denylist.confirmRemove'))) {
				return;
			}
			setBusy(true);
			setError(null);
			try {
				await removePlatformOpsDenylistEntry(id);
				await refresh();
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setBusy(false);
			}
		},
		[refresh, setBusy, setError, t]
	);

	const onPublish = React.useCallback(async () => {
		if (!window.confirm(t('adminPlatformOps.denylist.confirmPublish'))) {
			return;
		}
		setBusy(true);
		setError(null);
		setLastPublishMsg(null);
		try {
			const result = await publishPlatformOpsDenylist(
				publishNote.trim() || null
			);
			setLastPublishMsg(
				t('adminPlatformOps.denylist.publishOk', {
					count: result.revoked_count,
					path: result.out_path,
				})
			);
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}, [publishNote, refresh, setBusy, setError, t]);

	const ready =
		Boolean(status?.updates_out_configured) &&
		Boolean(status?.signing_key_configured);

	return (
		<section
			className={`${PLATFORM_OPS_PANEL} space-y-3 p-4`}
			aria-labelledby="soft-revoke-denylist-heading"
		>
			<h3
				id="soft-revoke-denylist-heading"
				className="text-sm font-medium text-white"
			>
				{t('adminPlatformOps.denylist.title')}
			</h3>
			<p className="text-sm text-slate-400">
				{t('adminPlatformOps.denylist.hint')}
			</p>

			{status ? (
				<ul className="space-y-1 text-xs text-slate-400">
					<li>
						{t('adminPlatformOps.denylist.pending', {
							count: status.pending_count,
						})}
					</li>
					<li>
						{t('adminPlatformOps.denylist.lastPublish', {
							at: status.published_at ?? '—',
							count: status.revoked_count,
						})}
					</li>
					<li>
						{t('adminPlatformOps.denylist.envReady', {
							updates: status.updates_out_configured
								? t('adminPlatformOps.denylist.yes')
								: t('adminPlatformOps.denylist.no'),
							signing: status.signing_key_configured
								? t('adminPlatformOps.denylist.yes')
								: t('adminPlatformOps.denylist.no'),
						})}
					</li>
					{status.out_path ? (
						<li className="break-all font-mono text-slate-500">
							{status.out_path}
						</li>
					) : null}
				</ul>
			) : null}

			{!ready && status ? (
				<p className="text-sm text-amber-300/90" role="status">
					{t('adminPlatformOps.denylist.envMissing')}
				</p>
			) : null}

			<div className="flex flex-wrap items-end gap-3">
				<label className="flex min-w-64 flex-1 flex-col gap-1 text-xs text-slate-400">
					{t('adminPlatformOps.denylist.licenseId')}
					<input
						className="rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-sm text-white"
						value={licenseId}
						disabled={busy || loading}
						onChange={(e) => setLicenseId(e.target.value)}
						placeholder="uuid"
						spellCheck={false}
					/>
				</label>
				<label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-slate-400">
					{t('adminPlatformOps.denylist.reason')}
					<input
						className="rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
						value={reason}
						disabled={busy || loading}
						onChange={(e) => setReason(e.target.value)}
						maxLength={500}
					/>
				</label>
				<button
					type="button"
					className={DESKTOP_INTERACTIVE.button}
					disabled={busy || loading}
					onClick={() => void onAdd()}
				>
					{t('adminPlatformOps.denylist.add')}
				</button>
				<button
					type="button"
					className={DESKTOP_INTERACTIVE.button}
					disabled={busy || loading}
					onClick={() => void refresh()}
				>
					{t('adminPlatformOps.denylist.refresh')}
				</button>
			</div>

			<div className="overflow-x-auto">
				<table className="w-full min-w-xl border-collapse text-left text-sm text-slate-200">
					<thead>
						<tr className="border-b border-white/10 text-xs text-slate-400">
							<th className="px-2 py-1.5 font-medium">
								{t('adminPlatformOps.denylist.colLicense')}
							</th>
							<th className="px-2 py-1.5 font-medium">
								{t('adminPlatformOps.denylist.colLabel')}
							</th>
							<th className="px-2 py-1.5 font-medium">
								{t('adminPlatformOps.denylist.colReason')}
							</th>
							<th className="px-2 py-1.5 font-medium">
								{t('adminPlatformOps.denylist.colCreated')}
							</th>
							<th className="px-2 py-1.5 font-medium" />
						</tr>
					</thead>
					<tbody>
						{(status?.entries ?? []).length === 0 ? (
							<tr>
								<td colSpan={5} className="px-2 py-3 text-slate-500">
									{loading
										? t('adminPlatformOps.denylist.loading')
										: t('adminPlatformOps.denylist.empty')}
								</td>
							</tr>
						) : (
							(status?.entries ?? []).map((row) => (
								<tr key={row.license_id} className="border-b border-white/5">
									<td className="px-2 py-1.5 font-mono text-xs">
										{row.license_id}
									</td>
									<td className="px-2 py-1.5">
										{row.license_label ?? '—'}
										{row.license_status ? ` (${row.license_status})` : ''}
									</td>
									<td className="px-2 py-1.5 text-slate-400">
										{row.reason ?? '—'}
									</td>
									<td className="px-2 py-1.5 text-xs text-slate-500">
										{row.created_at}
									</td>
									<td className="px-2 py-1.5 text-right">
										<button
											type="button"
											className={`${DESKTOP_INTERACTIVE.button} text-rose-200`}
											disabled={busy}
											onClick={() => void onRemove(row.license_id)}
										>
											{t('adminPlatformOps.denylist.remove')}
										</button>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			<div className="flex flex-wrap items-end gap-3 border-t border-white/10 pt-3">
				<label className="flex min-w-64 flex-1 flex-col gap-1 text-xs text-slate-400">
					{t('adminPlatformOps.denylist.publishNote')}
					<input
						className="rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
						value={publishNote}
						disabled={busy || !ready}
						onChange={(e) => setPublishNote(e.target.value)}
						maxLength={500}
					/>
				</label>
				<button
					type="button"
					className={`${DESKTOP_INTERACTIVE.button} border-amber-400/40 bg-amber-500/10 text-amber-100`}
					disabled={busy || loading || !ready}
					onClick={() => void onPublish()}
				>
					{t('adminPlatformOps.denylist.publish')}
				</button>
			</div>
			{lastPublishMsg ? (
				<p className="text-sm text-emerald-300/90" role="status">
					{lastPublishMsg}
				</p>
			) : null}
			<p className="text-xs text-slate-500">
				{t('adminPlatformOps.denylist.syncHint')}
			</p>
		</section>
	);
}
