/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * KBSEW admin — per-AI-surface toggles + shared allowed barrels for knowledge_base_search.
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownTrayIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '../../Desktop/constants';
import {
	getDesktopAiChatDefaults,
	listKbsewBarrels,
	patchDesktopAiChatDefaults,
	type KbsewBarrel,
	type KbsewRetrievalMode,
} from '../kbsewAdminApi';
import { KbsewDegradedBanner } from './KbsewDegradedBanner';
import {
	countKbsewEnabledAgents,
	KBSEW_AGENT_SURFACES,
	KBSEW_AGENT_WIRED,
	KBSEW_CHUNKS_PER_BARREL_MAX,
	KBSEW_CHUNKS_PER_BARREL_MIN,
	KBSEW_RETRIEVAL_MODE_DEFAULT,
	kbsewAgentToolVisible,
	mergeKbsewSettingsIntoDefaults,
	readKbsewSettingsFromDefaults,
	type KbsewAgentSurfaceKey,
	type KbsewSearchSettingsForm,
} from './kbsewSearchSettings';

export function KbsewAgentAccessTab(): React.ReactElement {
	const { t } = useTranslation('desktopUi');
	const [barrels, setBarrels] = React.useState<KbsewBarrel[]>([]);
	const [defaults, setDefaults] = React.useState<Record<string, unknown>>({});
	const [form, setForm] = React.useState<KbsewSearchSettingsForm>(() => ({
		agents: {
			desktop: false,
			ewa: false,
			marketing: false,
			imperorg: false,
			ugs: false,
		},
		allowedBarrelIds: [],
		chunksPerBarrel: 5,
		rerankEnabled: false,
		retrievalMode: KBSEW_RETRIEVAL_MODE_DEFAULT,
	}));
	const [loading, setLoading] = React.useState(true);
	const [saving, setSaving] = React.useState(false);
	const [msg, setMsg] = React.useState<string | null>(null);
	const [error, setError] = React.useState<string | null>(null);

	const load = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		setMsg(null);
		try {
			const [rows, defs] = await Promise.all([
				listKbsewBarrels(),
				getDesktopAiChatDefaults(),
			]);
			setBarrels(rows);
			setDefaults(defs);
			setForm(readKbsewSettingsFromDefaults(defs));
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		void load();
	}, [load]);

	const toggleAgent = (agent: KbsewAgentSurfaceKey) => {
		setForm((prev) => ({
			...prev,
			agents: { ...prev.agents, [agent]: !prev.agents[agent] },
		}));
	};

	const toggleBarrel = (barrelId: string) => {
		setForm((prev) => {
			const set = new Set(prev.allowedBarrelIds);
			if (set.has(barrelId)) {
				set.delete(barrelId);
			} else {
				set.add(barrelId);
			}
			return { ...prev, allowedBarrelIds: [...set] };
		});
	};

	const selectAllEnabled = () => {
		setForm((prev) => ({
			...prev,
			allowedBarrelIds: barrels.filter((b) => b.enabled).map((b) => b.id),
		}));
	};

	const clearAllowed = () => {
		setForm((prev) => ({ ...prev, allowedBarrelIds: [] }));
	};

	const save = async () => {
		setSaving(true);
		setMsg(null);
		setError(null);
		try {
			const merged = mergeKbsewSettingsIntoDefaults(defaults, form);
			const saved = await patchDesktopAiChatDefaults(merged);
			setDefaults(saved);
			setForm(readKbsewSettingsFromDefaults(saved));
			setMsg(t('adminKbsew.agentAccess.saved'));
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	const enabledAgentCount = countKbsewEnabledAgents(form);
	const hasBarrels = form.allowedBarrelIds.length > 0;
	const busy = loading || saving;

	return (
		<div className="space-y-4 max-w-3xl">
			<p className={`${DESKTOP_TYPOGRAPHY.body} text-white/70`}>
				{t('adminKbsew.agentAccess.description')}
			</p>

			{error ? <KbsewDegradedBanner tone="error" message={error} /> : null}
			{msg ? <KbsewDegradedBanner tone="success" message={msg} /> : null}

			<div
				className={`rounded-xl border px-4 py-3 ${
					enabledAgentCount > 0 && hasBarrels
						? 'border-emerald-500/30 bg-emerald-500/5'
						: 'border-amber-500/30 bg-amber-500/5'
				}`}
			>
				<div className={`${DESKTOP_TYPOGRAPHY.subtitle} text-white/95`}>
					{t('adminKbsew.agentAccess.statusSummary', {
						count: enabledAgentCount,
					})}
				</div>
				<p className={`${DESKTOP_TYPOGRAPHY.caption} mt-1 text-white/60`}>
					{t('adminKbsew.agentAccess.statusHint')}
				</p>
			</div>

			<section className="rounded-xl border border-white/10 bg-black/25 p-4">
				<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
					<h4
						className={`${DESKTOP_TYPOGRAPHY.caption} uppercase tracking-wide text-white/55`}
					>
						{t('adminKbsew.agentAccess.surfacesTitle')}
					</h4>
					<button
						type="button"
						className={`${DESKTOP_INTERACTIVE.btnRounded} inline-flex items-center gap-1 px-3 py-1 text-xs`}
						disabled={busy}
						onClick={() => void load()}
					>
						<ArrowPathIcon className="h-3.5 w-3.5" />
						{t('adminKbsew.refresh')}
					</button>
				</div>

				<div className="grid gap-2 sm:grid-cols-2">
					{KBSEW_AGENT_SURFACES.map((surface) => {
						const active = kbsewAgentToolVisible(form, surface);
						const wired = KBSEW_AGENT_WIRED[surface];
						return (
							<label
								key={surface}
								className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 ${
									active
										? 'border-violet-400/40 bg-violet-500/10'
										: 'border-white/10 bg-white/3'
								}`}
							>
								<input
									type="checkbox"
									className="mt-1 rounded border-white/20 bg-black/40"
									checked={form.agents[surface]}
									disabled={busy}
									onChange={() => toggleAgent(surface)}
								/>
								<span className="min-w-0 flex-1">
									<span className="font-medium text-white/95">
										{t(`adminKbsew.agentAccess.surfaces.${surface}.label`)}
									</span>
									<span className="mt-0.5 block text-xs text-white/55">
										{t(`adminKbsew.agentAccess.surfaces.${surface}.hint`)}
									</span>
									<span
										className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
											wired
												? 'border-emerald-500/40 text-emerald-200/90'
												: 'border-amber-500/40 text-amber-200/90'
										}`}
									>
										{wired
											? t('adminKbsew.agentAccess.wired')
											: t('adminKbsew.agentAccess.planned')}
									</span>
								</span>
							</label>
						);
					})}
				</div>

				<h4
					className={`${DESKTOP_TYPOGRAPHY.caption} mt-6 mb-2 uppercase tracking-wide text-white/55`}
				>
					{t('adminKbsew.agentAccess.retrievalTitle')}
				</h4>
				<p className={`${DESKTOP_TYPOGRAPHY.caption} mb-3 text-white/55`}>
					{t('adminKbsew.agentAccess.retrievalHint')}
				</p>
				<div className="grid gap-3 sm:grid-cols-2">
					<label className="block">
						<span className={`${DESKTOP_TYPOGRAPHY.caption} text-white/60`}>
							{t('adminKbsew.agentAccess.chunksPerBarrelLabel')}
						</span>
						<input
							type="number"
							min={KBSEW_CHUNKS_PER_BARREL_MIN}
							max={KBSEW_CHUNKS_PER_BARREL_MAX}
							className={`${DESKTOP_INTERACTIVE.input} mt-1 w-full`}
							value={form.chunksPerBarrel}
							disabled={busy}
							onChange={(e) => {
								const next = Number.parseInt(e.target.value, 10);
								setForm((prev) => ({
									...prev,
									chunksPerBarrel: Number.isNaN(next)
										? prev.chunksPerBarrel
										: Math.max(
												KBSEW_CHUNKS_PER_BARREL_MIN,
												Math.min(KBSEW_CHUNKS_PER_BARREL_MAX, next)
											),
								}));
							}}
						/>
					</label>
					<label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/3 px-3 py-2">
						<input
							type="checkbox"
							className="mt-1 rounded border-white/20 bg-black/40"
							checked={form.rerankEnabled}
							disabled={busy}
							onChange={() =>
								setForm((prev) => ({
									...prev,
									rerankEnabled: !prev.rerankEnabled,
								}))
							}
						/>
						<span className="min-w-0 flex-1">
							<span className="font-medium text-white/95">
								{t('adminKbsew.agentAccess.rerankLabel')}
							</span>
							<span className="mt-0.5 block text-xs text-white/55">
								{t('adminKbsew.agentAccess.rerankHint')}
							</span>
						</span>
					</label>
				</div>

				<label className="mt-3 block">
					<span className={`${DESKTOP_TYPOGRAPHY.caption} text-white/60`}>
						{t('adminKbsew.agentAccess.retrievalModeLabel')}
					</span>
					<select
						className={`${DESKTOP_INTERACTIVE.input} mt-1 w-full sm:max-w-xs`}
						value={form.retrievalMode}
						disabled={busy}
						onChange={(e) => {
							const next = e.target.value as KbsewRetrievalMode;
							setForm((prev) => ({
								...prev,
								retrievalMode: next === 'hybrid' ? 'hybrid' : 'dense',
							}));
						}}
					>
						<option value="dense">
							{t('adminKbsew.agentAccess.retrievalModeDense')}
						</option>
						<option value="hybrid">
							{t('adminKbsew.agentAccess.retrievalModeHybrid')}
						</option>
					</select>
					<span className="mt-1 block text-xs text-white/55">
						{t('adminKbsew.agentAccess.retrievalModeHint')}
					</span>
				</label>

				<h4
					className={`${DESKTOP_TYPOGRAPHY.caption} mt-6 mb-2 uppercase tracking-wide text-white/55`}
				>
					{t('adminKbsew.agentAccess.allowedTitle')}
				</h4>
				<p className={`${DESKTOP_TYPOGRAPHY.caption} mb-2 text-white/55`}>
					{t('adminKbsew.agentAccess.allowedHint')}
				</p>
				<div className="mb-2 flex flex-wrap gap-2">
					<button
						type="button"
						className={`${DESKTOP_INTERACTIVE.btnRounded} px-2 py-1 text-xs`}
						disabled={busy}
						onClick={selectAllEnabled}
					>
						{t('adminKbsew.agentAccess.selectAllEnabled')}
					</button>
					<button
						type="button"
						className={`${DESKTOP_INTERACTIVE.btnRounded} px-2 py-1 text-xs`}
						disabled={busy}
						onClick={clearAllowed}
					>
						{t('adminKbsew.agentAccess.clearAllowed')}
					</button>
				</div>

				{loading ? (
					<p className="text-sm text-white/60">{t('adminKbsew.loading')}</p>
				) : barrels.length === 0 ? (
					<p className="text-sm text-white/60">
						{t('adminKbsew.agentAccess.noBarrels')}
					</p>
				) : (
					<ul className="max-h-72 space-y-2 overflow-auto pr-1">
						{barrels.map((barrel) => {
							const checked = form.allowedBarrelIds.includes(barrel.id);
							return (
								<li
									key={barrel.id}
									className={`rounded-lg border px-3 py-2 ${
										checked
											? 'border-violet-400/40 bg-violet-500/10'
											: 'border-white/10 bg-white/3'
									}`}
								>
									<label className="flex cursor-pointer items-start gap-3">
										<input
											type="checkbox"
											className="mt-1 rounded border-white/20 bg-black/40"
											checked={checked}
											disabled={busy}
											onChange={() => toggleBarrel(barrel.id)}
										/>
										<span className="min-w-0 flex-1">
											<span className="font-medium text-white/95">
												{barrel.name}
											</span>
											<span className="mt-0.5 block font-mono text-xs text-white/50">
												{barrel.id}
											</span>
											<span className="mt-1 block text-xs text-white/55">
												{barrel.driver_type} · {barrel.asset_count}{' '}
												{t('adminKbsew.assets')}
												{barrel.enabled
													? ` · ${t('adminKbsew.enabled')}`
													: ` · ${t('adminKbsew.disabled')}`}
											</span>
										</span>
									</label>
								</li>
							);
						})}
					</ul>
				)}

				<button
					type="button"
					className={`${DESKTOP_INTERACTIVE.btnPrimary} mt-4 inline-flex items-center gap-1 px-4 py-2 text-sm`}
					disabled={busy}
					onClick={() => void save()}
				>
					<ArrowDownTrayIcon className="h-4 w-4" />
					{t('adminKbsew.agentAccess.save')}
				</button>
			</section>
		</div>
	);
}
