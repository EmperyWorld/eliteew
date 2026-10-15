/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified Admin Factory hub on New World atoms (Wave 1): pack stems, cancel, kill-all mode.
 *
 * Invariants:
 * - Uses pages/Admin/ui only for controls (no DESKTOP_INTERACTIVE / Old World chrome).
 * - Empty intention list is a valid success state.
 * - Kill-all requires DangerConfirmModal with mode cancel|pause (default cancel).
 *
 * Related:
 * - pages/Admin/factory/factoryApi.ts
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 * - documentation/platform/docker-re_doc/ADMIN-FACTORY-OPS.md
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';

import {
	AdminButton,
	AdminField,
	AdminRowActions,
	AdminSelect,
	AdminStatusBanner,
	DangerConfirmModal,
	PackStemPicker,
} from '../ui';
import { AdminSectionFrame } from '../shell/AdminSectionFrame';
import { getAdminShellSectionMeta } from '../shell/adminShellConfig';
import {
	cancelFactoryIntention,
	enqueueFactoryIntention,
	evaluateFactoryAssembly,
	getFactoryStatus,
	killAllFactoryIntentions,
	listFactoryIntentions,
	pauseFactoryIntention,
	resumeFactoryIntention,
	tickFactoryIntention,
	type FactoryIntention,
	type FactoryStatusSnapshot,
} from './factoryApi';
import { FACTORY_PACK_STEM_OPTIONS } from './factoryPackStemOptions';

export interface FactoryAdminPanelProps {
	urlSyncEnabled?: boolean;
}

export function FactoryAdminPanel({
	urlSyncEnabled: _urlSyncEnabled = true,
}: FactoryAdminPanelProps): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const meta = getAdminShellSectionMeta('factory');
	const [status, setStatus] = React.useState<FactoryStatusSnapshot | null>(
		null
	);
	const [items, setItems] = React.useState<FactoryIntention[]>([]);
	const [title, setTitle] = React.useState('Factory plan/verify');
	const [packStems, setPackStems] = React.useState<string[]>(['notifications']);
	const [busy, setBusy] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [hint, setHint] = React.useState<string | null>(null);
	const [killMode, setKillMode] = React.useState<'cancel' | 'pause'>('cancel');
	const [killConfirmOpen, setKillConfirmOpen] = React.useState(false);

	const refresh = React.useCallback(async () => {
		setError(null);
		try {
			const [st, list] = await Promise.all([
				getFactoryStatus(),
				listFactoryIntentions(),
			]);
			setStatus(st);
			setItems(list.items);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, []);

	React.useEffect(() => {
		void refresh();
	}, [refresh]);

	const runAction = async (fn: () => Promise<void>) => {
		setBusy(true);
		setError(null);
		try {
			await fn();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	};

	const onEnqueue = () =>
		void runAction(async () => {
			if (packStems.length === 0) {
				throw new Error(
					t('adminFactory.packStemsRequired', 'Select at least one pack stem')
				);
			}
			await enqueueFactoryIntention({
				title: title.trim() || 'Factory plan/verify',
				pack_stems: packStems,
				run_ticks: 3,
			});
			await refresh();
		});

	const onEvaluateAssembly = () =>
		void runAction(async () => {
			const out = await evaluateFactoryAssembly({
				pack_stems: packStems,
				intent: title.trim() || packStems[0] || 'factory',
			});
			const s = out.result.gate_s?.status ?? '—';
			setHint(
				`${out.result.verdict} · T=${out.result.gate_t.status} · C=${out.result.gate_c.status} · S=${s}`
			);
		});

	const onConfirmKillAll = () =>
		void runAction(async () => {
			setKillConfirmOpen(false);
			const out = await killAllFactoryIntentions({ mode: killMode });
			setHint(
				t(
					'adminFactory.killAllResult',
					'Kill-all ({{mode}}): affected={{affected}} cancelled={{cancelled}} paused={{paused}}',
					{
						mode: out.mode,
						affected: out.affected,
						cancelled: out.cancelled.length,
						paused: out.paused.length,
					}
				)
			);
			await refresh();
		});

	const assemblyOn = Boolean(status?.assembly);
	const maxFix = status?.max_fix_loops ?? 3;

	return (
		<AdminSectionFrame variant="full">
			<p className="sr-only">{meta.description}</p>
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-1 text-sm text-[var(--admin-ui-fg-muted)]">
					<div>
						{t(
							'adminFactory.autonomousHint',
							'Autonomous implement: {{state}}. Default is plan/verify only.',
							{ state: status?.autonomous ? 'ON' : 'OFF' }
						)}
					</div>
					<div>
						{t(
							'adminFactory.assemblyHint',
							'Config-driven assembly (Gate T∧C∧S): {{state}}. Env ELITEEW_FACTORY_ASSEMBLY (default OFF).',
							{ state: assemblyOn ? 'ON' : 'OFF' }
						)}
					</div>
					<div>
						{t(
							'adminFactory.maxFixLoopsHint',
							'Max fix loops: {{n}} (ELITEEW_FACTORY_MAX_FIX_LOOPS).',
							{ n: maxFix }
						)}
					</div>
				</div>

				{error ? <AdminStatusBanner tone="danger" title={error} /> : null}
				{hint ? (
					<AdminStatusBanner tone="info">{hint}</AdminStatusBanner>
				) : null}

				<div className="flex min-w-[16rem] flex-col gap-1 text-sm text-[var(--admin-ui-fg-muted)]">
					<span id="factory-title-label">
						{t('adminFactory.titleLabel', 'Intention title')}
					</span>
					<AdminField
						aria-labelledby="factory-title-label"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						disabled={busy}
					/>
				</div>

				<div className="space-y-1">
					<p className="text-sm text-[var(--admin-ui-fg-muted)]">
						{t('adminFactory.packStemsLabel', 'Pack stems')}
					</p>
					<PackStemPicker
						options={FACTORY_PACK_STEM_OPTIONS}
						value={packStems}
						onChange={setPackStems}
						disabled={busy}
						customLabel={t('adminFactory.customStem', 'Custom stem')}
						addLabel={t('adminFactory.addStem', 'Add')}
					/>
				</div>

				<div className="flex flex-wrap items-end gap-2">
					<AdminButton variant="primary" disabled={busy} onClick={onEnqueue}>
						{t('adminFactory.enqueue', 'Enqueue plan/verify')}
					</AdminButton>
					<AdminButton
						variant="secondary"
						disabled={busy || !assemblyOn}
						title={
							assemblyOn
								? undefined
								: t(
										'adminFactory.assemblyDisabledTitle',
										'Set ELITEEW_FACTORY_ASSEMBLY=1 to enable'
									)
						}
						onClick={onEvaluateAssembly}
					>
						{t('adminFactory.evaluateAssembly', 'Evaluate Gate T∧C∧S')}
					</AdminButton>
					<div className="flex flex-col gap-1 text-sm text-[var(--admin-ui-fg-muted)]">
						<span id="factory-kill-mode-label">
							{t('adminFactory.killMode', 'Kill-all mode')}
						</span>
						<AdminSelect
							aria-labelledby="factory-kill-mode-label"
							value={killMode}
							disabled={busy}
							onChange={(e) =>
								setKillMode(e.target.value === 'pause' ? 'pause' : 'cancel')
							}
						>
							<option value="cancel">
								{t('adminFactory.killModeCancel', 'cancel')}
							</option>
							<option value="pause">
								{t('adminFactory.killModePause', 'pause')}
							</option>
						</AdminSelect>
					</div>
					<AdminButton
						variant="danger"
						disabled={busy || items.length === 0}
						onClick={() => setKillConfirmOpen(true)}
					>
						{t('adminFactory.killAll', 'Kill all active')}
					</AdminButton>
					<AdminButton
						variant="ghost"
						disabled={busy}
						onClick={() => void refresh()}
					>
						{t('adminFactory.refresh', 'Refresh')}
					</AdminButton>
				</div>

				{items.length === 0 ? (
					<p className="text-sm text-[var(--admin-ui-fg-muted)]">
						{t('adminFactory.empty', 'No factory intentions yet.')}
					</p>
				) : (
					<ul className="divide-y divide-[var(--admin-ui-border)] rounded-[var(--admin-ui-radius)] border border-[var(--admin-ui-border)]">
						{items.map((item) => (
							<li
								key={item.id}
								className="flex flex-col gap-2 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
							>
								<div>
									<div className="font-medium text-[var(--admin-ui-fg)]">
										{item.title}
									</div>
									<div className="text-[var(--admin-ui-fg-muted)]">
										{item.status} · {item.stage}
										{item.pack_stems?.length
											? ` · packs=${item.pack_stems.join(',')}`
											: ''}
										{item.pause_reason ? ` · ${item.pause_reason}` : ''}
										{item.verify_status
											? ` · verify=${item.verify_status}`
											: ''}
									</div>
								</div>
								<AdminRowActions>
									<AdminButton
										variant="ghost"
										disabled={busy}
										onClick={() =>
											void runAction(async () => {
												await tickFactoryIntention(item.id);
												await refresh();
											})
										}
									>
										{t('adminFactory.tick', 'Tick')}
									</AdminButton>
									<AdminButton
										variant="ghost"
										disabled={busy}
										onClick={() =>
											void runAction(async () => {
												await pauseFactoryIntention(item.id);
												await refresh();
											})
										}
									>
										{t('adminFactory.pause', 'Pause')}
									</AdminButton>
									<AdminButton
										variant="ghost"
										disabled={busy}
										onClick={() =>
											void runAction(async () => {
												await resumeFactoryIntention(item.id);
												await refresh();
											})
										}
									>
										{t('adminFactory.resume', 'Resume')}
									</AdminButton>
									<AdminButton
										variant="danger"
										disabled={busy}
										onClick={() =>
											void runAction(async () => {
												await cancelFactoryIntention(item.id);
												await refresh();
											})
										}
									>
										{t('adminFactory.cancel', 'Cancel')}
									</AdminButton>
								</AdminRowActions>
							</li>
						))}
					</ul>
				)}
			</div>

			<DangerConfirmModal
				open={killConfirmOpen}
				title={t('adminFactory.killConfirmTitle', 'Kill all active intentions')}
				description={t(
					'adminFactory.killConfirmBody',
					'This will {{mode}} all non-terminal factory intentions.',
					{ mode: killMode }
				)}
				confirmPhrase="KILL"
				confirmLabel={t('adminFactory.killConfirmAction', 'Kill all')}
				cancelLabel={t('adminFactory.killConfirmCancel', 'Back')}
				busy={busy}
				onCancel={() => setKillConfirmOpen(false)}
				onConfirm={onConfirmKillAll}
			/>
		</AdminSectionFrame>
	);
}
