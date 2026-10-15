/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Platform Ops · Desktop Client hub — licenses (edit), soft revoke (OTA),
 * seat issue, Air enrollment, portal peers, Capsule fleet migration, atomic binding recovery,
 * and Wave 6 atomic binding fleet inventory.
 *
 * Invariants:
 * - Seat pack download is primary handout; peer create secrets shown once.
 * - Air reveal code is show-once and never reconstructed from GET history.
 * - Mutations use `/api/v1/desktop/admin/platform-ops/*` (admin JWT).
 * - Hard license revoke is DB status; soft denylist is a separate workspace.
 * - FoFline entitlement is additive `allow_fofline` (default deny); not overloaded into seat mode.
 *
 * Related:
 * - `pages/Admin/platformOps/platformOpsApi.ts`
 * - `pages/Admin/platformOps/licenses/LicenseInventoryPanel.tsx`
 * - `pages/Admin/platformOps/licenses/SoftRevokeDenylistPanel.tsx`
 * - `pages/Admin/platformOps/AirEnrollPanel.tsx`
 * - documentation/platform/docker-re_doc/ADMIN-PLATFORM-OPS.md
 */

import * as React from 'react';
import type { TFunction } from 'i18next';
import { DESKTOP_INTERACTIVE } from '../../Desktop/constants';
import { AirEnrollPanel } from './AirEnrollPanel';
import { AtomicBindingFleetPanel } from './AtomicBindingFleetPanel';
import { BindingRecoveryPanel } from './BindingRecoveryPanel';
import { LicenseInventoryPanel } from './licenses/LicenseInventoryPanel';
import { SoftRevokeDenylistPanel } from './licenses/SoftRevokeDenylistPanel';
import { PLATFORM_OPS_PANEL as PANEL } from './platformOpsPanelChrome';
import {
	createPlatformOpsPortalPeer,
	getPlatformOpsFleetMigrationSummary,
	getPlatformOpsLicense,
	issuePlatformOpsSeat,
	listPlatformOpsLicenseDevices,
	listPlatformOpsPortalPeers,
	patchPlatformOpsLicense,
	revokePlatformOpsLicense,
	revokePlatformOpsLicenseDevice,
	revokePlatformOpsPortalPeer,
	syncPlatformOpsPortalPeers,
	type PlatformOpsFleetMigrationSummary,
	type PlatformOpsLicenseCapabilities,
	type PlatformOpsLicenseDevice,
	type PlatformOpsPortalPeer,
	type PlatformOpsPortalPeerCreateResult,
	type PlatformOpsSeatIssueResult,
	type PlatformOpsSeatMode,
} from './platformOpsApi';

function downloadSeatPackage(result: PlatformOpsSeatIssueResult): void {
	const pkg = result.package as Record<string, unknown>;
	const encoding = typeof pkg.encoding === 'string' ? pkg.encoding : '';
	const b64 = typeof pkg.package_b64 === 'string' ? pkg.package_b64 : '';
	let blob: Blob;
	if (encoding === 'ecap_v3' && b64) {
		const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
		blob = new Blob([bin], { type: 'application/octet-stream' });
	} else {
		blob = new Blob([JSON.stringify(result.package, null, 2)], {
			type: 'application/json',
		});
	}
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = result.filename || 'eliteew-seat.json';
	a.click();
	URL.revokeObjectURL(url);
}

export function PlatformOpsPortalPeersPanel({
	t,
}: {
	t: TFunction;
}): React.ReactElement {
	const [peers, setPeers] = React.useState<PlatformOpsPortalPeer[]>([]);
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [slug, setSlug] = React.useState('');
	const [label, setLabel] = React.useState('');
	const [busy, setBusy] = React.useState(false);
	const [created, setCreated] =
		React.useState<PlatformOpsPortalPeerCreateResult | null>(null);
	const [syncMsg, setSyncMsg] = React.useState<string | null>(null);
	const [seatMode, setSeatMode] =
		React.useState<PlatformOpsSeatMode>('offline');
	const [seatLabel, setSeatLabel] = React.useState('');
	const [seatSlug, setSeatSlug] = React.useState('');
	const [seatAllowedEmail, setSeatAllowedEmail] = React.useState('');
	const [seatAllowFofline, setSeatAllowFofline] = React.useState(false);
	const [seatDeviceRequestText, setSeatDeviceRequestText] = React.useState('');
	const [seatDeviceRequestError, setSeatDeviceRequestError] = React.useState<
		string | null
	>(null);
	const [seatResult, setSeatResult] =
		React.useState<PlatformOpsSeatIssueResult | null>(null);
	const [capLicenseId, setCapLicenseId] = React.useState('');
	const [capView, setCapView] =
		React.useState<PlatformOpsLicenseCapabilities | null>(null);
	const [capEmail, setCapEmail] = React.useState('');
	const [capMode, setCapMode] = React.useState<PlatformOpsSeatMode>('offline');
	const [capAllowFofline, setCapAllowFofline] = React.useState(false);
	const [capLabel, setCapLabel] = React.useState('');
	const [capExpires, setCapExpires] = React.useState('');
	const [capDevices, setCapDevices] = React.useState<
		PlatformOpsLicenseDevice[]
	>([]);
	type Workspace =
		| 'licenses'
		| 'denylist'
		| 'seats'
		| 'airEnroll'
		| 'peers'
		| 'fleet'
		| 'bindingRecovery'
		| 'atomicFleet';
	const [workspace, setWorkspace] = React.useState<Workspace>('licenses');
	const licenseEditorRef = React.useRef<HTMLElement | null>(null);
	const [fleetSummary, setFleetSummary] =
		React.useState<PlatformOpsFleetMigrationSummary | null>(null);
	const [fleetLoading, setFleetLoading] = React.useState(false);

	const refresh = React.useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const rows = await listPlatformOpsPortalPeers();
			setPeers(rows);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		void refresh();
	}, [refresh]);

	const refreshFleet = React.useCallback(async () => {
		setFleetLoading(true);
		setError(null);
		try {
			const summary = await getPlatformOpsFleetMigrationSummary();
			setFleetSummary(summary);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setFleetLoading(false);
		}
	}, []);

	React.useEffect(() => {
		if (workspace === 'fleet') {
			void refreshFleet();
		}
	}, [workspace, refreshFleet]);

	const onCreate = React.useCallback(async () => {
		const s = slug.trim();
		if (!s) return;
		setBusy(true);
		setError(null);
		setCreated(null);
		try {
			const result = await createPlatformOpsPortalPeer({
				slug: s,
				label: label.trim() || null,
			});
			setCreated(result);
			setSlug('');
			setLabel('');
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}, [slug, label, refresh]);

	const onRevoke = React.useCallback(
		async (peerId: string) => {
			if (!window.confirm(t('adminPlatformOps.portalPeers.confirmRevoke'))) {
				return;
			}
			setBusy(true);
			setError(null);
			try {
				await revokePlatformOpsPortalPeer(peerId);
				await refresh();
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setBusy(false);
			}
		},
		[refresh, t]
	);

	const onSync = React.useCallback(async () => {
		setBusy(true);
		setError(null);
		setSyncMsg(null);
		try {
			const res = await syncPlatformOpsPortalPeers();
			setSyncMsg(
				res.message ?? `ok configured=${res.configured} skipped=${res.skipped}`
			);
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}, [refresh]);

	const onIssueSeat = React.useCallback(async () => {
		setBusy(true);
		setError(null);
		setSeatResult(null);
		setSeatDeviceRequestError(null);
		try {
			let deviceRequest: import('./platformOpsApi').PlatformOpsDeviceRequest;
			try {
				const parsed = JSON.parse(seatDeviceRequestText) as unknown;
				if (!parsed || typeof parsed !== 'object') {
					throw new Error('not object');
				}
				deviceRequest =
					parsed as import('./platformOpsApi').PlatformOpsDeviceRequest;
				if (deviceRequest.kind !== 'device_request_v1') {
					throw new Error('kind');
				}
			} catch {
				setSeatDeviceRequestError(
					'Загрузите или вставьте JSON запроса устройства (device_request_v1).'
				);
				return;
			}
			const needsPeer = seatMode === 'cloud' || seatMode === 'both';
			const result = await issuePlatformOpsSeat({
				mode: seatMode,
				label: seatLabel.trim() || null,
				slug: needsPeer ? seatSlug.trim() || null : null,
				allowed_email: seatAllowedEmail.trim() || null,
				allow_fofline: seatAllowFofline,
				device_request: deviceRequest,
			});
			setSeatResult(result);
			downloadSeatPackage(result);
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}, [
		refresh,
		seatAllowFofline,
		seatAllowedEmail,
		seatDeviceRequestText,
		seatLabel,
		seatMode,
		seatSlug,
	]);

	const applyCapView = React.useCallback(
		(view: PlatformOpsLicenseCapabilities) => {
			setCapView(view);
			setCapLicenseId(view.license_id);
			setCapEmail(view.allowed_email || '');
			setCapLabel(view.label || '');
			setCapExpires(view.expires_at ? view.expires_at.slice(0, 16) : '');
			setCapAllowFofline(Boolean(view.allow_fofline));
			const m = view.mode;
			setCapMode(
				m === 'cloud' || m === 'both' || m === 'offline' ? m : 'offline'
			);
		},
		[]
	);

	const onLoadCapabilities = React.useCallback(async () => {
		const id = capLicenseId.trim();
		if (!id) return;
		setBusy(true);
		setError(null);
		try {
			const view = await getPlatformOpsLicense(id);
			applyCapView(view);
			const devices = await listPlatformOpsLicenseDevices(id);
			setCapDevices(devices);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}, [applyCapView, capLicenseId]);

	const onOpenLicenseFromInventory = React.useCallback(
		(licenseId: string) => {
			setWorkspace('licenses');
			setCapLicenseId(licenseId);
			void (async () => {
				setBusy(true);
				setError(null);
				try {
					const view = await getPlatformOpsLicense(licenseId);
					applyCapView(view);
					const devices = await listPlatformOpsLicenseDevices(licenseId);
					setCapDevices(devices);
					requestAnimationFrame(() => {
						licenseEditorRef.current?.scrollIntoView({
							behavior: 'smooth',
							block: 'start',
						});
					});
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(false);
				}
			})();
		},
		[applyCapView]
	);

	const onSaveCapabilities = React.useCallback(async () => {
		const id = (capView?.license_id || capLicenseId).trim();
		if (!id) return;
		setBusy(true);
		setError(null);
		try {
			const allow_offline = capMode === 'offline' || capMode === 'both';
			const allow_online = capMode === 'cloud' || capMode === 'both';
			const email = capEmail.trim();
			const label = capLabel.trim();
			const expiresRaw = capExpires.trim();
			const view = await patchPlatformOpsLicense(id, {
				allow_offline,
				allow_online,
				allow_fofline: capAllowFofline,
				allowed_email: email || null,
				clear_allowed_email: !email,
				label: label || null,
				expires_at: expiresRaw ? new Date(expiresRaw).toISOString() : null,
				clear_expires: !expiresRaw,
			});
			applyCapView(view);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}, [
		applyCapView,
		capAllowFofline,
		capEmail,
		capExpires,
		capLabel,
		capLicenseId,
		capMode,
		capView?.license_id,
	]);

	const onClearAccountBind = React.useCallback(async () => {
		const id = (capView?.license_id || capLicenseId).trim();
		if (!id) return;
		if (!window.confirm(t('adminPlatformOps.licenses.confirmClearBind'))) {
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const view = await patchPlatformOpsLicense(id, {
				clear_account_bind: true,
				clear_allowed_email: true,
			});
			applyCapView(view);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}, [applyCapView, capLicenseId, capView?.license_id, t]);

	const onHardRevokeLicense = React.useCallback(async () => {
		const id = (capView?.license_id || capLicenseId).trim();
		if (!id) return;
		if (!window.confirm(t('adminPlatformOps.licenses.confirmHardRevoke'))) {
			return;
		}
		setBusy(true);
		setError(null);
		try {
			await revokePlatformOpsLicense(id);
			const view = await getPlatformOpsLicense(id);
			applyCapView(view);
			setCapDevices(await listPlatformOpsLicenseDevices(id));
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	}, [applyCapView, capLicenseId, capView?.license_id, t]);

	const onRevokeDevice = React.useCallback(
		async (deviceId: string) => {
			const id = (capView?.license_id || capLicenseId).trim();
			if (!id) return;
			if (!window.confirm(t('adminPlatformOps.licenses.confirmDeviceRevoke'))) {
				return;
			}
			setBusy(true);
			setError(null);
			try {
				await revokePlatformOpsLicenseDevice(id, deviceId);
				setCapDevices(await listPlatformOpsLicenseDevices(id));
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setBusy(false);
			}
		},
		[capLicenseId, capView?.license_id, t]
	);

	const workspaces: readonly Workspace[] = [
		'licenses',
		'denylist',
		'seats',
		'airEnroll',
		'peers',
		'fleet',
		'bindingRecovery',
		'atomicFleet',
	];

	return (
		<div className="space-y-4" data-testid="platform-ops-desktop-workspace">
			<header className={`${PANEL} space-y-2 p-4`}>
				<h2 className="text-base font-medium text-white">
					{t('adminPlatformOps.desktopHub.title')}
				</h2>
				<p className="text-sm text-slate-400">
					{t('adminPlatformOps.desktopHub.hint')}
				</p>
				<nav
					className="flex flex-wrap gap-2"
					aria-label={t('adminPlatformOps.desktopHub.navAria')}
				>
					{workspaces.map((id) => {
						const selected = workspace === id;
						return (
							<button
								key={id}
								type="button"
								className={`${DESKTOP_INTERACTIVE.button} ${
									selected
										? 'border-emerald-400/50 bg-emerald-500/15 text-white'
										: 'text-slate-300'
								}`}
								aria-pressed={selected}
								onClick={() => setWorkspace(id)}
							>
								{t(`adminPlatformOps.desktopHub.tabs.${id}`)}
							</button>
						);
					})}
				</nav>
			</header>

			{error ? (
				<p className="text-sm text-rose-300" role="alert">
					{t('adminPlatformOps.portalPeers.actionFailed', { error })}
				</p>
			) : null}

			{workspace === 'licenses' ? (
				<div className="space-y-4">
					<p className="rounded border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-sm text-sky-100">
						{t('adminPlatformOps.licenses.howTo')}
					</p>
					<LicenseInventoryPanel
						t={t}
						busy={busy}
						setBusy={setBusy}
						setError={setError}
						onOpenLicense={onOpenLicenseFromInventory}
					/>

					<section
						ref={licenseEditorRef}
						className={`${PANEL} space-y-3 p-4 ${
							capView ? 'ring-1 ring-emerald-400/30' : ''
						}`}
						aria-labelledby="license-cap-heading"
						data-testid="license-editor"
					>
						<h3
							id="license-cap-heading"
							className="text-sm font-medium text-white"
						>
							{t('adminPlatformOps.licenses.title')}
						</h3>
						<p className="text-sm text-slate-400">
							{t('adminPlatformOps.licenses.hint')}
						</p>
						<div className="flex flex-wrap items-end gap-3">
							<label className="flex flex-col gap-1 text-xs text-slate-400">
								{t('adminPlatformOps.licenses.licenseId')}
								<input
									className="min-w-[18rem] rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-sm text-white"
									value={capLicenseId}
									onChange={(e) => setCapLicenseId(e.target.value)}
									placeholder="uuid"
									disabled={busy}
								/>
							</label>
							<button
								type="button"
								className={DESKTOP_INTERACTIVE.button}
								disabled={busy || !capLicenseId.trim()}
								onClick={() => void onLoadCapabilities()}
							>
								{t('adminPlatformOps.licenses.load')}
							</button>
						</div>
						{capView ? (
							<div className="space-y-3 rounded border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
								<p className="text-xs text-slate-300">
									<span className="font-mono text-slate-400">
										{capView.license_id}
									</span>
									{' · '}
									{t(
										`adminPlatformOps.licenses.statusValue.${capView.status}`,
										{
											defaultValue: capView.status,
										}
									)}
									{' · '}
									{t(`adminPlatformOps.licenses.modeValue.${capView.mode}`, {
										defaultValue: capView.mode,
									})}
								</p>
								{capView.bound_keycloak_sub ? (
									<p className="text-xs text-amber-200/90">
										{t('adminPlatformOps.licenses.boundSub', {
											sub: `${capView.bound_keycloak_sub.slice(0, 12)}…`,
										})}
									</p>
								) : (
									<p className="text-xs text-slate-400">
										{t('adminPlatformOps.licenses.unbound')}
									</p>
								)}
								<fieldset className="space-y-2 border-0 p-0">
									<legend className="mb-1 text-xs text-slate-400">
										{t('adminPlatformOps.licenses.mode')}
									</legend>
									<div className="flex flex-wrap gap-2">
										{(['offline', 'cloud', 'both'] as const).map((value) => (
											<label
												key={value}
												className={`cursor-pointer rounded border px-2 py-1 text-xs ${
													capMode === value
														? 'border-emerald-400/50 bg-emerald-500/15'
														: 'border-white/10'
												}`}
											>
												<input
													type="radio"
													name="cap-mode"
													className="sr-only"
													checked={capMode === value}
													disabled={busy}
													onChange={() => setCapMode(value)}
												/>
												{t(
													`adminPlatformOps.seats.${
														value === 'offline'
															? 'modeOffline'
															: value === 'cloud'
																? 'modeCloud'
																: 'modeBoth'
													}`
												)}
											</label>
										))}
									</div>
								</fieldset>
								<label
									className={`flex max-w-xl cursor-pointer items-start gap-3 rounded border px-3 py-2 text-sm ${
										capAllowFofline
											? 'border-sky-400/40 bg-sky-500/10 text-white'
											: 'border-white/10 bg-black/20 text-slate-200'
									}`}
									data-testid="license-allow-fofline"
								>
									<input
										type="checkbox"
										className="mt-1"
										checked={capAllowFofline}
										disabled={busy}
										onChange={(e) => setCapAllowFofline(e.target.checked)}
									/>
									<span>
										<strong className="block">
											{t('adminPlatformOps.seats.allowFofline')}
										</strong>
										<span className="mt-1 block text-xs text-slate-400">
											{t('adminPlatformOps.seats.allowFoflineHint')}
										</span>
									</span>
								</label>
								<label className="flex flex-col gap-1 text-xs text-slate-400">
									{t('adminPlatformOps.seats.label')}
									<input
										className="max-w-md rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
										value={capLabel}
										onChange={(e) => setCapLabel(e.target.value)}
										disabled={busy}
									/>
								</label>
								<label className="flex flex-col gap-1 text-xs text-slate-400">
									{t('adminPlatformOps.seats.allowedEmail')}
									<input
										className="max-w-md rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
										value={capEmail}
										onChange={(e) => setCapEmail(e.target.value)}
										disabled={busy}
									/>
								</label>
								<label className="flex flex-col gap-1 text-xs text-slate-400">
									{t('adminPlatformOps.licenses.expiresAt')}
									<input
										type="datetime-local"
										className="max-w-md rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
										value={capExpires}
										onChange={(e) => setCapExpires(e.target.value)}
										disabled={busy}
									/>
								</label>
								<div className="flex flex-wrap gap-2">
									<button
										type="button"
										className={DESKTOP_INTERACTIVE.button}
										disabled={busy}
										onClick={() => void onSaveCapabilities()}
									>
										{t('adminPlatformOps.licenses.save')}
									</button>
									<button
										type="button"
										className={DESKTOP_INTERACTIVE.button}
										disabled={busy}
										onClick={() => void onClearAccountBind()}
									>
										{t('adminPlatformOps.licenses.clearBind')}
									</button>
									{capView.status === 'active' ? (
										<button
											type="button"
											className={`${DESKTOP_INTERACTIVE.button} text-rose-200`}
											disabled={busy}
											onClick={() => void onHardRevokeLicense()}
										>
											{t('adminPlatformOps.licenses.hardRevoke')}
										</button>
									) : null}
								</div>
								<div className="space-y-2 border-t border-white/10 pt-3">
									<p className="text-xs font-medium text-slate-300">
										{t('adminPlatformOps.licenses.devicesTitle')}
									</p>
									{capDevices.length === 0 ? (
										<p className="text-xs text-slate-500">
											{t('adminPlatformOps.licenses.devicesEmpty')}
										</p>
									) : (
										<ul className="space-y-2">
											{capDevices.map((d) => (
												<li
													key={d.device_id}
													className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/10 bg-black/30 px-2 py-1.5 text-xs"
												>
													<span className="font-mono text-slate-300">
														{t(
															`adminPlatformOps.licenses.statusValue.${d.status}`,
															{ defaultValue: d.status }
														)}{' '}
														· {d.machine_fingerprint.slice(0, 12)}…
													</span>
													{d.status === 'active' ? (
														<button
															type="button"
															className={DESKTOP_INTERACTIVE.button}
															disabled={busy}
															onClick={() => void onRevokeDevice(d.device_id)}
														>
															{t('adminPlatformOps.licenses.revokeDevice')}
														</button>
													) : null}
												</li>
											))}
										</ul>
									)}
								</div>
							</div>
						) : (
							<p className="text-sm text-slate-500">
								{t('adminPlatformOps.licenses.editorEmpty')}
							</p>
						)}
					</section>
				</div>
			) : null}

			{workspace === 'denylist' ? (
				<SoftRevokeDenylistPanel
					t={t}
					busy={busy}
					setBusy={setBusy}
					setError={setError}
				/>
			) : null}

			{workspace === 'seats' ? (
				<section
					className={`${PANEL} space-y-3 p-4`}
					aria-labelledby="seat-issue-heading"
				>
					<h3
						id="seat-issue-heading"
						className="text-sm font-medium text-white"
					>
						{t('adminPlatformOps.seats.title')}
					</h3>
					<p className="text-sm text-slate-400">
						{t('adminPlatformOps.seats.hint')}
					</p>
					<fieldset className="space-y-2 border-0 p-0">
						<legend className="mb-1 text-xs text-slate-400">
							{t('adminPlatformOps.seats.mode')}
						</legend>
						<div className="flex w-full flex-wrap gap-3">
							{(
								[
									['offline', 'modeOffline', 'modeOfflineHint'],
									['cloud', 'modeCloud', 'modeCloudHint'],
									['both', 'modeBoth', 'modeBothHint'],
								] as const
							).map(([value, labelKey, hintKey]) => {
								const selected = seatMode === value;
								const id = `seat-mode-${value}`;
								return (
									<label
										key={value}
										htmlFor={id}
										className={`max-w-sm flex-1 cursor-pointer rounded border px-3 py-2 text-left text-sm transition ${
											selected
												? 'border-emerald-400/50 bg-emerald-500/15 text-white'
												: 'border-white/10 bg-black/20 text-slate-200 hover:border-white/25'
										}`}
									>
										<input
											id={id}
											type="radio"
											name="seat-mode"
											className="sr-only"
											checked={selected}
											disabled={busy}
											onChange={() => setSeatMode(value)}
										/>
										<strong className="block">
											{t(`adminPlatformOps.seats.${labelKey}`)}
										</strong>
										<span className="mt-1 block text-xs text-slate-400">
											{t(`adminPlatformOps.seats.${hintKey}`)}
										</span>
										{value === 'offline' ? (
											<span className="mt-1 block text-[10px] uppercase tracking-wide text-emerald-300/80">
												{t('adminPlatformOps.seats.modeRecommended')}
											</span>
										) : null}
									</label>
								);
							})}
						</div>
					</fieldset>
					<label
						className={`flex max-w-xl cursor-pointer items-start gap-3 rounded border px-3 py-2 text-sm ${
							seatAllowFofline
								? 'border-sky-400/40 bg-sky-500/10 text-white'
								: 'border-white/10 bg-black/20 text-slate-200'
						}`}
						data-testid="seat-allow-fofline"
					>
						<input
							type="checkbox"
							className="mt-1"
							checked={seatAllowFofline}
							disabled={busy}
							onChange={(e) => setSeatAllowFofline(e.target.checked)}
						/>
						<span>
							<strong className="block">
								{t('adminPlatformOps.seats.allowFofline')}
							</strong>
							<span className="mt-1 block text-xs text-slate-400">
								{t('adminPlatformOps.seats.allowFoflineHint')}
							</span>
						</span>
					</label>
					<div className="flex flex-wrap items-end gap-3">
						<label className="flex flex-col gap-1 text-xs text-slate-400">
							{t('adminPlatformOps.seats.label')}
							<input
								className="min-w-40 rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
								value={seatLabel}
								onChange={(e) => setSeatLabel(e.target.value)}
								placeholder={t('adminPlatformOps.seats.labelPlaceholder')}
								disabled={busy}
							/>
						</label>
						<label className="flex flex-col gap-1 text-xs text-slate-400">
							{t('adminPlatformOps.seats.allowedEmail')}
							<input
								className="min-w-56 rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
								value={seatAllowedEmail}
								onChange={(e) => setSeatAllowedEmail(e.target.value)}
								placeholder={t(
									'adminPlatformOps.seats.allowedEmailPlaceholder'
								)}
								disabled={busy}
							/>
						</label>
						{seatMode === 'cloud' || seatMode === 'both' ? (
							<label className="flex flex-col gap-1 text-xs text-slate-400">
								{t('adminPlatformOps.seats.slugOptional')}
								<input
									className="min-w-48 rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
									value={seatSlug}
									onChange={(e) => setSeatSlug(e.target.value)}
									placeholder="seat-pilot-1"
									disabled={busy}
								/>
							</label>
						) : null}
					</div>
					<label className="mt-3 flex flex-col gap-1 text-xs text-slate-400">
						Запрос устройства (JSON / файл)
						<textarea
							className="min-h-[8rem] w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-xs text-white"
							value={seatDeviceRequestText}
							onChange={(e) => setSeatDeviceRequestText(e.target.value)}
							placeholder='{"kind":"device_request_v1",...}'
							disabled={busy}
						/>
					</label>
					<input
						type="file"
						accept="application/json,.json"
						className="mt-2 block text-sm text-slate-300"
						disabled={busy}
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (!file) return;
							void file.text().then((text) => setSeatDeviceRequestText(text));
						}}
					/>
					{seatDeviceRequestError ? (
						<p className="mt-2 text-sm text-red-400">
							{seatDeviceRequestError}
						</p>
					) : null}
					<div className="mt-3 flex flex-wrap items-end gap-3">
						<button
							type="button"
							className={DESKTOP_INTERACTIVE.button}
							disabled={busy}
							onClick={() => void onIssueSeat()}
						>
							{busy
								? t('adminPlatformOps.seats.issuing')
								: t('adminPlatformOps.seats.issue')}
						</button>
					</div>
					{seatResult ? (
						<div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
							<p>{t('adminPlatformOps.seats.issuedOnce')}</p>
							<p className="mt-1 font-mono text-xs text-emerald-200/90">
								{seatResult.filename}
							</p>
							<button
								type="button"
								className={`${DESKTOP_INTERACTIVE.button} mt-2`}
								onClick={() => downloadSeatPackage(seatResult)}
							>
								{t('adminPlatformOps.seats.downloadAgain')}
							</button>
						</div>
					) : null}
				</section>
			) : null}

			{workspace === 'airEnroll' ? (
				<AirEnrollPanel
					t={t}
					busy={busy}
					setBusy={setBusy}
					setError={setError}
				/>
			) : null}

			{workspace === 'peers' ? (
				<div className="space-y-4">
					<p className="text-sm text-slate-400">
						{t('adminPlatformOps.portalPeers.hint')}
					</p>

					<div className={`${PANEL} flex flex-wrap items-end gap-3 p-4`}>
						<label className="flex flex-col gap-1 text-xs text-slate-400">
							{t('adminPlatformOps.portalPeers.slug')}
							<input
								className="min-w-48 rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
								value={slug}
								onChange={(e) => setSlug(e.target.value)}
								placeholder="desktop-client-pilot-3"
								disabled={busy}
							/>
						</label>
						<label className="flex flex-col gap-1 text-xs text-slate-400">
							{t('adminPlatformOps.portalPeers.label')}
							<input
								className="min-w-40 rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
								value={label}
								onChange={(e) => setLabel(e.target.value)}
								disabled={busy}
							/>
						</label>
						<button
							type="button"
							className={DESKTOP_INTERACTIVE.button}
							disabled={busy || !slug.trim()}
							onClick={() => void onCreate()}
						>
							{t('adminPlatformOps.portalPeers.create')}
						</button>
						<button
							type="button"
							className={DESKTOP_INTERACTIVE.button}
							disabled={busy}
							onClick={() => void onSync()}
						>
							{t('adminPlatformOps.portalPeers.sync')}
						</button>
						<button
							type="button"
							className={DESKTOP_INTERACTIVE.button}
							disabled={loading || busy}
							onClick={() => void refresh()}
						>
							{loading
								? t('adminPlatformOps.refreshing')
								: t('adminPlatformOps.refresh')}
						</button>
					</div>

					{syncMsg ? (
						<p className="text-sm text-emerald-300">{syncMsg}</p>
					) : null}

					{created ? (
						<div
							className={`${PANEL} space-y-2 border-amber-500/30 p-4`}
							role="status"
						>
							<p className="text-sm font-medium text-amber-200">
								{t('adminPlatformOps.portalPeers.secretsOnce')}
							</p>
							<p className="text-xs text-slate-400">
								{created.peer.slug} · {created.peer.assigned_ip} ·{' '}
								{created.peer.id}
							</p>
							<label className="block text-xs text-slate-400">
								{t('adminPlatformOps.portalPeers.privateKey')}
								<textarea
									readOnly
									className="mt-1 w-full rounded border border-white/10 bg-black/40 p-2 font-mono text-xs text-white"
									rows={2}
									value={created.private_key}
								/>
							</label>
							<label className="block text-xs text-slate-400">
								{t('adminPlatformOps.portalPeers.clientConf')}
								<textarea
									readOnly
									className="mt-1 w-full rounded border border-white/10 bg-black/40 p-2 font-mono text-xs text-white"
									rows={8}
									value={created.client_conf}
								/>
							</label>
							<button
								type="button"
								className={DESKTOP_INTERACTIVE.button}
								onClick={() => setCreated(null)}
							>
								{t('adminPlatformOps.portalPeers.dismissSecrets')}
							</button>
						</div>
					) : null}

					<div className={`${PANEL} overflow-x-auto p-2`}>
						<table className="w-full min-w-160 text-left text-sm text-slate-200">
							<thead className="text-xs uppercase tracking-wide text-slate-500">
								<tr>
									<th className="px-2 py-2">
										{t('adminPlatformOps.portalPeers.colSlug')}
									</th>
									<th className="px-2 py-2">
										{t('adminPlatformOps.portalPeers.colLicense')}
									</th>
									<th className="px-2 py-2">
										{t('adminPlatformOps.portalPeers.colIp')}
									</th>
									<th className="px-2 py-2">
										{t('adminPlatformOps.portalPeers.colStatus')}
									</th>
									<th className="px-2 py-2">
										{t('adminPlatformOps.portalPeers.colSync')}
									</th>
									<th className="px-2 py-2" />
								</tr>
							</thead>
							<tbody>
								{peers.length === 0 ? (
									<tr>
										<td
											colSpan={6}
											className="px-2 py-6 text-center text-slate-500"
										>
											{t('adminPlatformOps.portalPeers.empty')}
										</td>
									</tr>
								) : (
									peers.map((p) => (
										<tr key={p.id} className="border-t border-white/5">
											<td className="px-2 py-2 font-medium">{p.slug}</td>
											<td className="px-2 py-2 font-mono text-[10px] text-slate-400">
												{p.license_id ? (
													<button
														type="button"
														className="underline decoration-dotted hover:text-emerald-300"
														disabled={busy}
														onClick={() =>
															onOpenLicenseFromInventory(p.license_id as string)
														}
													>
														{p.license_id.slice(0, 8)}…
													</button>
												) : (
													'—'
												)}
											</td>
											<td className="px-2 py-2 font-mono text-xs">
												{p.assigned_ip}
											</td>
											<td className="px-2 py-2">{p.status}</td>
											<td className="px-2 py-2">
												{p.edge_sync_status}
												{p.edge_sync_error ? (
													<span className="ml-1 text-rose-300">
														({p.edge_sync_error})
													</span>
												) : null}
											</td>
											<td className="px-2 py-2 text-right">
												{p.status === 'active' ? (
													<button
														type="button"
														className={`${DESKTOP_INTERACTIVE.button} text-rose-200`}
														disabled={busy}
														onClick={() => void onRevoke(p.id)}
													>
														{t('adminPlatformOps.portalPeers.revoke')}
													</button>
												) : null}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>
			) : null}

			{workspace === 'fleet' ? (
				<section
					className={`${PANEL} space-y-3 p-4`}
					data-testid="platform-ops-fleet-migration"
				>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h3 className="text-sm font-medium text-white">
							{t('adminPlatformOps.fleet.title')}
						</h3>
						<button
							type="button"
							className={DESKTOP_INTERACTIVE.button}
							disabled={fleetLoading}
							onClick={() => void refreshFleet()}
						>
							{t('adminPlatformOps.fleet.refresh')}
						</button>
					</div>
					<p className="text-sm text-slate-400">
						{t('adminPlatformOps.fleet.hint')}
					</p>
					{fleetLoading && !fleetSummary ? (
						<p className="text-sm text-slate-400">…</p>
					) : null}
					{fleetSummary ? (
						<div className="grid gap-3 text-sm text-slate-200 md:grid-cols-2">
							<div className="rounded border border-white/10 p-3">
								<p className="mb-2 font-medium text-white">
									{t('adminPlatformOps.fleet.byStatus')}
								</p>
								<ul className="space-y-1">
									{Object.entries(fleetSummary.by_status).map(
										([status, count]) => (
											<li key={status}>
												{status}: {count}
											</li>
										)
									)}
									{Object.keys(fleetSummary.by_status).length === 0 ? (
										<li>{t('adminPlatformOps.fleet.emptyStatus')}</li>
									) : null}
								</ul>
								<p className="mt-2 text-slate-400">
									rows={fleetSummary.totals.migration_rows}
								</p>
							</div>
							<div className="rounded border border-white/10 p-3">
								<p className="mb-2 font-medium text-white">
									{t('adminPlatformOps.fleet.enrollment')}
								</p>
								<ul className="space-y-1">
									<li>issued={fleetSummary.enrollment.issued}</li>
									<li>activated={fleetSummary.enrollment.activated}</li>
									<li>
										pending_activation=
										{fleetSummary.enrollment.pending_activation}
									</li>
								</ul>
							</div>
							<div className="rounded border border-white/10 p-3 md:col-span-2">
								<p className="mb-2 font-medium text-white">
									{t('adminPlatformOps.fleet.presenceVersions')}
								</p>
								<ul className="max-h-48 space-y-1 overflow-auto">
									{fleetSummary.presence_versions.map((row) => (
										<li key={row.app_version}>
											{row.app_version}: {row.count}
										</li>
									))}
									{fleetSummary.presence_versions.length === 0 ? (
										<li>{t('adminPlatformOps.fleet.emptyPresence')}</li>
									) : null}
								</ul>
							</div>
							<div className="rounded border border-white/10 p-3 md:col-span-2">
								<p className="mb-2 font-medium text-white">
									{t('adminPlatformOps.fleet.multiPeers')}
								</p>
								<ul className="max-h-40 space-y-1 overflow-auto font-mono text-xs">
									{fleetSummary.licenses_with_multi_active_peers.map((row) => (
										<li key={row.license_id}>
											{row.license_id} · peers={row.active_peers}
										</li>
									))}
									{fleetSummary.licenses_with_multi_active_peers.length ===
									0 ? (
										<li>{t('adminPlatformOps.fleet.emptyMulti')}</li>
									) : null}
								</ul>
							</div>
						</div>
					) : null}
				</section>
			) : null}

			{workspace === 'bindingRecovery' ? (
				<BindingRecoveryPanel
					t={t}
					busy={busy}
					setBusy={setBusy}
					setError={setError}
				/>
			) : null}

			{workspace === 'atomicFleet' ? (
				<AtomicBindingFleetPanel
					t={t}
					busy={busy}
					setBusy={setBusy}
					setError={setError}
				/>
			) : null}
		</div>
	);
}
