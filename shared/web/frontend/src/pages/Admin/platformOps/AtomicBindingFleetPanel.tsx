/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Platform Ops workspace for Wave 6 atomic binding fleet inventory / migrate.
 *
 * Invariants:
 * - Counts only — no email/sub/PII in the UI.
 * - Apply requires explicit confirm; dry-run is default.
 * - Does not change license status.
 *
 * Related:
 * - pages/Admin/platformOps/platformOpsApi.ts
 * - documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md
 */

import * as React from 'react';
import type { TFunction } from 'i18next';
import { DESKTOP_INTERACTIVE } from '../../Desktop/constants';
import {
	getPlatformOpsAtomicBindingFleetInventory,
	migratePlatformOpsAtomicBindingFleet,
	type PlatformOpsAtomicBindingFleetInventory,
	type PlatformOpsAtomicBindingFleetMigrateResult,
} from './platformOpsApi';
import { PLATFORM_OPS_PANEL } from './platformOpsPanelChrome';

export function AtomicBindingFleetPanel({
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
	const [inventory, setInventory] =
		React.useState<PlatformOpsAtomicBindingFleetInventory | null>(null);
	const [lastMigrate, setLastMigrate] =
		React.useState<PlatformOpsAtomicBindingFleetMigrateResult | null>(null);
	const [loading, setLoading] = React.useState(false);
	const [confirmApply, setConfirmApply] = React.useState(false);

	const refresh = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			setInventory(await getPlatformOpsAtomicBindingFleetInventory());
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [setError]);

	React.useEffect(() => {
		void refresh();
	}, [refresh]);

	const runMigrate = React.useCallback(
		async (dryRun: boolean) => {
			if (!dryRun && !confirmApply) {
				setError(t('adminPlatformOps.atomicFleet.confirmRequired'));
				return;
			}
			setBusy(true);
			setError(null);
			try {
				const result = await migratePlatformOpsAtomicBindingFleet({
					dry_run: dryRun,
					confirm: !dryRun,
				});
				setLastMigrate(result);
				await refresh();
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setBusy(false);
			}
		},
		[confirmApply, refresh, setBusy, setError, t]
	);

	const rows: ReadonlyArray<{
		key: keyof PlatformOpsAtomicBindingFleetInventory;
		labelKey: string;
	}> = [
		{ key: 'active_licenses', labelKey: 'activeLicenses' },
		{ key: 'active_allow_online', labelKey: 'allowOnline' },
		{ key: 'active_allow_fofline', labelKey: 'allowFofline' },
		{ key: 'active_with_bound_sub', labelKey: 'withBoundSub' },
		{ key: 'active_devices', labelKey: 'devices' },
		{ key: 'devices_with_pubkey', labelKey: 'devicesWithPubkey' },
		{ key: 'identity_bindings', labelKey: 'bindings' },
		{ key: 'identity_bindings_active', labelKey: 'bindingsActive' },
		{ key: 'identity_bindings_restricted', labelKey: 'bindingsRestricted' },
		{ key: 'identity_bindings_pending_pop', labelKey: 'bindingsPendingPop' },
		{ key: 'slots_needing_create', labelKey: 'slotsCreate' },
		{ key: 'slots_already_migrated', labelKey: 'slotsMigrated' },
		{ key: 'slots_conflict', labelKey: 'slotsConflict' },
		{ key: 'slots_skip_no_bound_sub', labelKey: 'slotsSkipNoSub' },
		{ key: 'slots_skip_channel_disabled', labelKey: 'slotsSkipChannel' },
	];

	return (
		<section
			className={`${PLATFORM_OPS_PANEL} space-y-4 p-4`}
			data-testid="platform-ops-atomic-binding-fleet"
		>
			<header className="space-y-1">
				<h3 className="text-sm font-medium text-white">
					{t('adminPlatformOps.atomicFleet.title')}
				</h3>
				<p className="text-sm text-slate-400">
					{t('adminPlatformOps.atomicFleet.hint')}
				</p>
			</header>

			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					className={DESKTOP_INTERACTIVE.button}
					disabled={busy || loading}
					onClick={() => void refresh()}
				>
					{t('adminPlatformOps.atomicFleet.refresh')}
				</button>
				<button
					type="button"
					className={DESKTOP_INTERACTIVE.button}
					disabled={busy || loading}
					onClick={() => void runMigrate(true)}
				>
					{t('adminPlatformOps.atomicFleet.dryRun')}
				</button>
				<button
					type="button"
					className={`${DESKTOP_INTERACTIVE.button} border-amber-400/40`}
					disabled={busy || loading || !confirmApply}
					onClick={() => void runMigrate(false)}
				>
					{t('adminPlatformOps.atomicFleet.apply')}
				</button>
			</div>

			<label className="flex items-center gap-2 text-sm text-slate-300">
				<input
					type="checkbox"
					checked={confirmApply}
					onChange={(e) => setConfirmApply(e.target.checked)}
					disabled={busy}
				/>
				{t('adminPlatformOps.atomicFleet.confirmLabel')}
			</label>

			{inventory ? (
				<ul className="grid gap-2 sm:grid-cols-2">
					{rows.map(({ key, labelKey }) => (
						<li
							key={key}
							className="flex justify-between gap-3 rounded border border-white/10 px-3 py-2 text-sm"
						>
							<span className="text-slate-400">
								{t(`adminPlatformOps.atomicFleet.counts.${labelKey}`)}
							</span>
							<span className="font-mono text-white">{inventory[key]}</span>
						</li>
					))}
				</ul>
			) : (
				<p className="text-sm text-slate-500">
					{loading
						? t('adminPlatformOps.atomicFleet.loading')
						: t('adminPlatformOps.atomicFleet.empty')}
				</p>
			)}

			{lastMigrate ? (
				<p
					className="text-sm text-slate-300"
					data-testid="atomic-fleet-migrate-result"
				>
					{t('adminPlatformOps.atomicFleet.lastResult', {
						mode: lastMigrate.dry_run
							? t('adminPlatformOps.atomicFleet.modeDry')
							: t('adminPlatformOps.atomicFleet.modeApply'),
						created: lastMigrate.created,
						already: lastMigrate.already_migrated,
						conflict: lastMigrate.conflict,
						kcOk: lastMigrate.kc_attrs_synced,
						kcFail: lastMigrate.kc_attrs_failed,
					})}
				</p>
			) : null}
		</section>
	);
}
