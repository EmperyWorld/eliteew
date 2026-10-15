/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin license inventory — list/filter, open capabilities, hard revoke (Wave A).
 *
 * Invariants:
 * - Hard revoke confirms explicitly; soft denylist is Wave B (not here).
 * - Never displays plaintext license keys.
 *
 * Related:
 * - pages/Admin/platformOps/platformOpsApi.ts
 * - documentation/platform/docker-re_doc/ADMIN-PLATFORM-OPS.md
 */

import * as React from 'react';
import type { TFunction } from 'i18next';
import { DESKTOP_INTERACTIVE } from '../../../Desktop/constants';
import {
	listPlatformOpsLicenses,
	revokePlatformOpsLicense,
	type PlatformOpsLicenseInventoryItem,
	type PlatformOpsSeatMode,
} from '../platformOpsApi';
import { PLATFORM_OPS_PANEL } from '../platformOpsPanelChrome';

export function LicenseInventoryPanel({
	t,
	busy,
	setBusy,
	setError,
	onOpenLicense,
}: {
	t: TFunction;
	busy: boolean;
	setBusy: (v: boolean) => void;
	setError: (v: string | null) => void;
	onOpenLicense: (licenseId: string) => void;
}): React.ReactElement {
	const [rows, setRows] = React.useState<PlatformOpsLicenseInventoryItem[]>([]);
	const [total, setTotal] = React.useState(0);
	const [status, setStatus] = React.useState<'all' | 'active' | 'revoked'>(
		'all'
	);
	const [mode, setMode] = React.useState<'all' | PlatformOpsSeatMode>('all');
	const [q, setQ] = React.useState('');
	const [loading, setLoading] = React.useState(false);

	const refresh = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await listPlatformOpsLicenses({
				status: status === 'all' ? null : status,
				mode: mode === 'all' ? null : mode,
				q: q.trim() || null,
				limit: 50,
				offset: 0,
			});
			setRows(res.licenses);
			setTotal(res.total);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [mode, q, setError, status]);

	React.useEffect(() => {
		void refresh();
	}, [refresh]);

	const onRevoke = React.useCallback(
		async (licenseId: string) => {
			if (!window.confirm(t('adminPlatformOps.licenses.confirmHardRevoke'))) {
				return;
			}
			setBusy(true);
			setError(null);
			try {
				await revokePlatformOpsLicense(licenseId);
				await refresh();
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setBusy(false);
			}
		},
		[refresh, setBusy, setError, t]
	);

	return (
		<section
			className={`${PLATFORM_OPS_PANEL} space-y-3 p-4`}
			aria-labelledby="license-inventory-heading"
		>
			<h3
				id="license-inventory-heading"
				className="text-sm font-medium text-white"
			>
				{t('adminPlatformOps.licenses.inventoryTitle')}
			</h3>
			<p className="text-sm text-slate-400">
				{t('adminPlatformOps.licenses.inventoryHint')}
			</p>
			<div className="flex flex-wrap items-end gap-3">
				<label className="flex flex-col gap-1 text-xs text-slate-400">
					{t('adminPlatformOps.licenses.filterStatus')}
					<select
						className="rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
						value={status}
						disabled={busy || loading}
						onChange={(e) =>
							setStatus(e.target.value as 'all' | 'active' | 'revoked')
						}
					>
						<option value="all">
							{t('adminPlatformOps.licenses.statusAll')}
						</option>
						<option value="active">
							{t('adminPlatformOps.licenses.statusActive')}
						</option>
						<option value="revoked">
							{t('adminPlatformOps.licenses.statusRevoked')}
						</option>
					</select>
				</label>
				<label className="flex flex-col gap-1 text-xs text-slate-400">
					{t('adminPlatformOps.licenses.filterMode')}
					<select
						className="rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
						value={mode}
						disabled={busy || loading}
						onChange={(e) =>
							setMode(e.target.value as 'all' | PlatformOpsSeatMode)
						}
					>
						<option value="all">
							{t('adminPlatformOps.licenses.modeAll')}
						</option>
						<option value="offline">
							{t('adminPlatformOps.seats.modeOffline')}
						</option>
						<option value="cloud">
							{t('adminPlatformOps.seats.modeCloud')}
						</option>
						<option value="both">{t('adminPlatformOps.seats.modeBoth')}</option>
					</select>
				</label>
				<label className="flex flex-col gap-1 text-xs text-slate-400">
					{t('adminPlatformOps.licenses.filterQuery')}
					<input
						className="min-w-56 rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder={t('adminPlatformOps.licenses.filterQueryPlaceholder')}
						disabled={busy || loading}
					/>
				</label>
				<button
					type="button"
					className={DESKTOP_INTERACTIVE.button}
					disabled={busy || loading}
					onClick={() => void refresh()}
				>
					{loading
						? t('adminPlatformOps.refreshing')
						: t('adminPlatformOps.refresh')}
				</button>
			</div>
			<p className="text-xs text-slate-500">
				{t('adminPlatformOps.licenses.total', { count: total })}
			</p>
			<div className="overflow-x-auto">
				<table className="w-full min-w-3xl text-left text-sm text-slate-200">
					<thead className="text-xs uppercase tracking-wide text-slate-500">
						<tr>
							<th className="px-2 py-2">
								{t('adminPlatformOps.licenses.colLabel')}
							</th>
							<th className="px-2 py-2">
								{t('adminPlatformOps.licenses.colMode')}
							</th>
							<th className="px-2 py-2">
								{t('adminPlatformOps.licenses.colFofline')}
							</th>
							<th className="px-2 py-2">
								{t('adminPlatformOps.licenses.colStatus')}
							</th>
							<th className="px-2 py-2">
								{t('adminPlatformOps.licenses.colEmail')}
							</th>
							<th className="px-2 py-2">
								{t('adminPlatformOps.licenses.colDevices')}
							</th>
							<th className="px-2 py-2" />
						</tr>
					</thead>
					<tbody>
						{rows.length === 0 ? (
							<tr>
								<td className="px-2 py-3 text-slate-500" colSpan={7}>
									{t('adminPlatformOps.licenses.inventoryEmpty')}
								</td>
							</tr>
						) : (
							rows.map((row) => (
								<tr key={row.license_id} className="border-t border-white/5">
									<td className="px-2 py-2">
										<div className="font-medium text-white">
											{row.label || '—'}
										</div>
										<div className="font-mono text-[10px] text-slate-500">
											{row.license_id}
										</div>
									</td>
									<td className="px-2 py-2">
										{t(`adminPlatformOps.licenses.modeValue.${row.mode}`, {
											defaultValue: row.mode,
										})}
									</td>
									<td className="px-2 py-2">
										{row.allow_fofline
											? t('adminPlatformOps.licenses.foflineYes')
											: t('adminPlatformOps.licenses.foflineNo')}
									</td>
									<td className="px-2 py-2">
										{t(`adminPlatformOps.licenses.statusValue.${row.status}`, {
											defaultValue: row.status,
										})}
									</td>
									<td className="px-2 py-2">{row.allowed_email || '—'}</td>
									<td className="px-2 py-2">{row.device_count_active}</td>
									<td className="px-2 py-2">
										<div className="flex flex-wrap gap-2">
											<button
												type="button"
												className={DESKTOP_INTERACTIVE.button}
												disabled={busy}
												onClick={() => onOpenLicense(row.license_id)}
											>
												{t('adminPlatformOps.licenses.open')}
											</button>
											{row.status === 'active' ? (
												<button
													type="button"
													className={DESKTOP_INTERACTIVE.button}
													disabled={busy}
													onClick={() => void onRevoke(row.license_id)}
												>
													{t('adminPlatformOps.licenses.hardRevoke')}
												</button>
											) : null}
										</div>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</section>
	);
}
