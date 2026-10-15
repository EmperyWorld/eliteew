/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Platform Ops workspace for atomic binding risk state and admin recovery.
 *
 * Invariants:
 * - Actions require confirm + reason; they never change license status.
 * - Does not expose DPoP JKT or refresh tokens.
 *
 * Related:
 * - pages/Admin/platformOps/platformOpsApi.ts
 * - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md
 */

import * as React from 'react';
import type { TFunction } from 'i18next';
import { DESKTOP_INTERACTIVE } from '../../Desktop/constants';
import {
	applyPlatformOpsAuthBindingAction,
	listPlatformOpsAuthBindings,
	type PlatformOpsAuthBinding,
	type PlatformOpsAuthRecoveryAction,
} from './platformOpsApi';
import { PLATFORM_OPS_PANEL } from './platformOpsPanelChrome';

const ACTIONS: readonly PlatformOpsAuthRecoveryAction[] = [
	'end_sessions',
	'quarantine_device',
	'restore_login',
	'allow_rebind',
	'clear_kc_login_failures',
];

export function BindingRecoveryPanel({
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
	const [licenseId, setLicenseId] = React.useState('');
	const [bindings, setBindings] = React.useState<PlatformOpsAuthBinding[]>([]);
	const [reason, setReason] = React.useState('');
	const [loading, setLoading] = React.useState(false);
	const [selectedId, setSelectedId] = React.useState<string | null>(null);

	const refresh = React.useCallback(async () => {
		const id = licenseId.trim();
		if (!id) {
			setBindings([]);
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const rows = await listPlatformOpsAuthBindings(id);
			setBindings(rows);
			if (rows.length > 0) {
				setSelectedId((current) =>
					current && rows.some((row) => row.binding_id === current)
						? current
						: rows[0].binding_id
				);
			} else {
				setSelectedId(null);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [licenseId, setError]);

	const selected =
		bindings.find((row) => row.binding_id === selectedId) ?? null;

	const onAction = React.useCallback(
		async (action: PlatformOpsAuthRecoveryAction) => {
			if (!selected) {
				return;
			}
			if (reason.trim().length < 8) {
				setError(t('adminPlatformOps.bindingRecovery.reasonRequired'));
				return;
			}
			if (
				!window.confirm(t(`adminPlatformOps.bindingRecovery.confirm.${action}`))
			) {
				return;
			}
			setBusy(true);
			setError(null);
			try {
				const result = await applyPlatformOpsAuthBindingAction(
					selected.binding_id,
					{
						action,
						reason: reason.trim(),
						idempotency_key: crypto.randomUUID(),
						confirm: true,
					}
				);
				if (!result.license_status_unchanged) {
					setError(t('adminPlatformOps.bindingRecovery.licenseTouched'));
				}
				await refresh();
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setBusy(false);
			}
		},
		[reason, refresh, selected, setBusy, setError, t]
	);

	return (
		<section
			className={`${PLATFORM_OPS_PANEL} space-y-3 p-4`}
			data-testid="platform-ops-binding-recovery"
		>
			<h3 className="text-sm font-medium text-white">
				{t('adminPlatformOps.bindingRecovery.title')}
			</h3>
			<p className="text-sm text-slate-400">
				{t('adminPlatformOps.bindingRecovery.hint')}
			</p>
			<div className="flex flex-wrap items-end gap-2">
				<label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-sm text-slate-300">
					{t('adminPlatformOps.licenses.licenseId')}
					<input
						className={DESKTOP_INTERACTIVE.input}
						value={licenseId}
						onChange={(ev) => setLicenseId(ev.target.value)}
						autoComplete="off"
					/>
				</label>
				<button
					type="button"
					className={DESKTOP_INTERACTIVE.button}
					disabled={loading || !licenseId.trim()}
					onClick={() => void refresh()}
				>
					{t('adminPlatformOps.bindingRecovery.load')}
				</button>
			</div>
			{bindings.length === 0 && !loading ? (
				<p className="text-sm text-slate-400">
					{t('adminPlatformOps.bindingRecovery.empty')}
				</p>
			) : (
				<ul className="space-y-2">
					{bindings.map((row) => {
						const selectedRow = row.binding_id === selectedId;
						return (
							<li key={row.binding_id}>
								<button
									type="button"
									className={`${DESKTOP_INTERACTIVE.button} w-full text-left ${
										selectedRow ? 'border-emerald-400/50 bg-emerald-500/15' : ''
									}`}
									aria-pressed={selectedRow}
									onClick={() => setSelectedId(row.binding_id)}
								>
									<span className="font-medium text-white">{row.state}</span>
									<span className="ml-2 text-slate-400">
										{row.client_id} · epoch {row.authz_epoch}
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			)}
			{selected ? (
				<div className="space-y-3">
					<p className="text-sm text-slate-300">
						{t('adminPlatformOps.bindingRecovery.selected', {
							state: selected.state,
							epoch: String(selected.authz_epoch),
						})}
					</p>
					<label className="flex flex-col gap-1 text-sm text-slate-300">
						{t('adminPlatformOps.bindingRecovery.reason')}
						<textarea
							className={DESKTOP_INTERACTIVE.input}
							rows={3}
							value={reason}
							onChange={(ev) => setReason(ev.target.value)}
						/>
					</label>
					<div className="flex flex-wrap gap-2">
						{ACTIONS.map((action) => (
							<button
								key={action}
								type="button"
								className={DESKTOP_INTERACTIVE.button}
								disabled={busy}
								onClick={() => void onAction(action)}
							>
								{t(`adminPlatformOps.bindingRecovery.actions.${action}`)}
							</button>
						))}
					</div>
					{selected.events.length > 0 ? (
						<ul className="space-y-1 text-sm text-slate-400">
							{selected.events.map((event) => (
								<li key={`${event.kind}-${event.created_at}`}>
									{event.kind}
									{event.resulting_state ? ` → ${event.resulting_state}` : ''}
								</li>
							))}
						</ul>
					) : (
						<p className="text-sm text-slate-500">
							{t('adminPlatformOps.bindingRecovery.noEvents')}
						</p>
					)}
				</div>
			) : null}
		</section>
	);
}
