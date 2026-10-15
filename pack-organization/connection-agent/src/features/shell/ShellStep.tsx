/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shell dashboard: status rail → elevated cloud Start → quiet updater;
 * secondary offline catalog; tertiary profile at ≥1600px.
 *
 * Invariants:
 * - Offline catalog only when entitlement ok and not denylisted.
 * - One filled primary above the fold (launch); updater idle stays quiet.
 *
 * Related:
 * - App.tsx step === 'shell'
 */

import { LauncherScreen } from '../launcher/LauncherScreen';
import { FoflineSpaPackStatus } from '../fofline/FoflineSpaPackStatus';
import { ProfileMenu } from '../profile-menu/ProfileMenu';
import { UpdaterStatus } from '../updater/UpdaterStatus';
import { APP_VERSION } from '../../lib/launcher/appVersion';
import {
	licenseChipValue,
	tunnelChipValue,
	updateChipValue,
} from '../../lib/launcher/shellChips';
import type {
	DenylistStatusView,
	EntitlementStatusView,
	WgPortalStatus,
} from '../../lib/tauri-bridge/commands';
import type { FoflineSpaPackUi } from '../../hooks/useFoflineSpaPack';
import { humanizeEntitlement, tunnelTone } from '../../lib/ui/statusCopy';
import { ConnectionStatusBar } from './ConnectionStatusBar';
import { shouldBlockShellForDenylist } from './denylistGate';
import { LicenseSummaryPanel } from './LicenseSummaryPanel';
import { OfflineShell } from './OfflineShell';
import './shell.css';

export type ShellStepProps = {
	appBase: string;
	enrollBase: string;
	wg: WgPortalStatus | null;
	entitlement: EntitlementStatusView | null;
	onlineBoundLabel: string | null;
	boundLabel: string;
	canOnlineStart: boolean;
	canFoflineStart?: boolean;
	launcherDetail: string;
	updaterMessage: string;
	updaterAvailable: string | null;
	updateCheckBusy: boolean;
	updateInstallBusy: boolean;
	updateRestartBusy: boolean;
	updaterNeedsRestart: boolean;
	graphicsRecoveryAvailable?: boolean;
	graphicsRecoveryBusy?: boolean;
	denylist: DenylistStatusView | null;
	foflineSpaPack?: FoflineSpaPackUi | null;
	onStart: () => void;
	onFoflineStart?: () => void;
	onFoflineSpaPackRetry?: () => void;
	onFoflineSpaPackUpdate?: () => void;
	onCheckUpdate: () => void;
	onInstall: () => void;
	onRestart: () => void;
	onGraphicsRecovery?: () => void;
	onRefreshDenylist: () => void;
	onGoHome: () => void;
	/** Retail: one action to verify / recover channel (no shell). */
	onCheckChannel?: () => void;
	channelCheckBusy?: boolean;
	/** Debug / non-sealed only — omitted in retail sealed UI. */
	onOpenTunnel?: () => void;
	/** Retail sealed: Stop userspace channel without OS wg. */
	onStopChannel?: () => void;
	channelStopBusy?: boolean;
	deviceBound?: boolean | null;
	onClearDeviceBind?: () => void;
	clearDeviceBindBusy?: boolean;
};

export function ShellStep(props: ShellStepProps) {
	const {
		appBase,
		enrollBase,
		wg,
		entitlement,
		onlineBoundLabel,
		boundLabel,
		canOnlineStart,
		canFoflineStart = false,
		launcherDetail,
		updaterMessage,
		updaterAvailable,
		updateCheckBusy,
		updateInstallBusy,
		updateRestartBusy,
		updaterNeedsRestart,
		graphicsRecoveryAvailable = false,
		graphicsRecoveryBusy = false,
		denylist,
		foflineSpaPack = null,
		onStart,
		onFoflineStart,
		onFoflineSpaPackRetry,
		onFoflineSpaPackUpdate,
		onCheckUpdate,
		onInstall,
		onRestart,
		onGraphicsRecovery,
		onRefreshDenylist,
		onGoHome,
		onCheckChannel,
		channelCheckBusy = false,
		onOpenTunnel,
		onStopChannel,
		channelStopBusy = false,
		deviceBound = null,
		onClearDeviceBind,
		clearDeviceBindBusy = false,
	} = props;

	const channelValue = tunnelChipValue(wg);
	const channelTone = tunnelTone(wg?.ok, wg?.code);
	const showChannelCheck =
		Boolean(onCheckChannel) &&
		(wg?.code === 'channel_unstable' ||
			wg?.code === 'channel_unconfirmed' ||
			wg?.code === 'channel_start_failed' ||
			wg?.code === 'reconnecting' ||
			wg?.code === 'socks_listening' ||
			wg?.code === 'socks_up' ||
			wg?.code === 'idle' ||
			wg?.code === 'down' ||
			(wg != null && !wg.ok));

	return (
		<div className="shell-split" data-layout="shell">
			<div className="shell-primary shell-dashboard">
				<div className="shell-status-rail">
					<ConnectionStatusBar
						chips={[
							{
								label: 'Канал',
								value: channelValue,
								tone: channelTone,
							},
							{
								label: 'Лицензия',
								value: licenseChipValue({
									entitlementOk: entitlement?.ok,
									hasEntitlement: Boolean(entitlement),
									onlineBoundLabel,
								}),
								tone: entitlement?.ok
									? 'ok'
									: onlineBoundLabel
										? 'warn'
										: 'neutral',
							},
							{
								label: 'Версия',
								value: updateChipValue({
									updaterAvailable,
									updateCheckBusy,
									updaterMessage,
								}),
								tone: updaterAvailable
									? 'warn'
									: updaterMessage.includes('актуальн')
										? 'ok'
										: 'neutral',
							},
						]}
					/>
				</div>
				{/* Full Security: mount only on entitlement fact — never onlineBoundLabel alone. */}
				{entitlement != null ? (
					<LicenseSummaryPanel
						entitlement={entitlement}
						onlineBoundLabel={onlineBoundLabel}
						boundLabel={boundLabel}
						channelLabel={channelValue}
						channelTone={channelTone}
						deviceBound={deviceBound}
					/>
				) : null}
				<LauncherScreen
					versionLabel={APP_VERSION}
					canStart={canOnlineStart}
					canCheckUpdate={true}
					updateBusy={updateCheckBusy}
					onStart={onStart}
					onCheckUpdate={onCheckUpdate}
					detail={launcherDetail}
					startLabel="Открыть облачный рабочий стол"
					canFoflineStart={canFoflineStart}
					onFoflineStart={onFoflineStart}
					foflineStartLabel="Открыть FoFline"
				/>
				{showChannelCheck ? (
					<div className="actions" style={{ marginTop: '0.75rem' }}>
						<button
							type="button"
							className="secondary"
							disabled={channelCheckBusy}
							onClick={onCheckChannel}
						>
							{channelCheckBusy
								? 'Проверка…'
								: wg?.code === 'reconnecting'
									? 'Повторить'
									: 'Проверить соединение'}
						</button>
					</div>
				) : null}
				{onStopChannel ? (
					<div className="actions" style={{ marginTop: '0.75rem' }}>
						<button
							type="button"
							className="secondary"
							disabled={channelStopBusy || !wg?.unit_active}
							onClick={onStopChannel}
						>
							{channelStopBusy ? 'Отключение…' : 'Отключить защищённый канал'}
						</button>
					</div>
				) : null}
				{foflineSpaPack ? (
					<FoflineSpaPackStatus
						pack={foflineSpaPack}
						onRetry={
							onFoflineSpaPackRetry ? () => onFoflineSpaPackRetry() : undefined
						}
						onUpdate={
							onFoflineSpaPackUpdate
								? () => onFoflineSpaPackUpdate()
								: undefined
						}
					/>
				) : null}
				<UpdaterStatus
					message={
						updaterAvailable
							? `${updaterMessage} · ${updaterAvailable}`
							: updaterMessage
					}
					availableVersion={updaterAvailable}
					canInstall={Boolean(updaterAvailable)}
					installBusy={updateInstallBusy}
					onInstall={onInstall}
					canRestart={updaterNeedsRestart}
					restartBusy={updateRestartBusy}
					onRestart={onRestart}
					graphicsRecoveryAvailable={graphicsRecoveryAvailable}
					graphicsRecoveryBusy={graphicsRecoveryBusy}
					onGraphicsRecovery={onGraphicsRecovery}
				/>
			</div>
			<div className="shell-secondary">
				{entitlement?.ok && shouldBlockShellForDenylist(denylist?.revoked) ? (
					<section className="panel" aria-labelledby="revoked-heading">
						<h2 id="revoked-heading">Лицензия отозвана</h2>
						<p className="status status-warn" role="alert">
							{denylist?.message ??
								'Лицензия отозвана удалённо. Офлайн-пакет заблокирован.'}
						</p>
						<p className="muted">
							Офлайн-приложения недоступны, пока оператор не снимет отзыв или не
							выдаст новую лицензию.
						</p>
						<div className="actions">
							<button
								type="button"
								className="secondary"
								onClick={onRefreshDenylist}
							>
								Проверить снова
							</button>
						</div>
					</section>
				) : entitlement?.ok ? (
					<OfflineShell
						edition={entitlement.edition ?? 'client'}
						profileId={entitlement.profile_id ?? null}
						apps={entitlement.apps ?? []}
						licenseId={entitlement.license_id ?? null}
						appVersion={APP_VERSION}
						appBase={appBase}
						detail="Офлайн-старт по локальной лицензии. Откройте приложение из каталога — панели работают на устройстве."
					/>
				) : (
					<section className="panel">
						<h2>Офлайн-режим</h2>
						<p className="status" role="status">
							{entitlement
								? humanizeEntitlement(entitlement.code, entitlement.message)
								: 'Нет проверенной лицензии — импортируйте пакет с USB для офлайн-работы.'}
						</p>
						<div className="actions">
							<button type="button" className="secondary" onClick={onGoHome}>
								К импорту или активации
							</button>
						</div>
					</section>
				)}
			</div>
			<div className="shell-tertiary">
				<ProfileMenu
					enrollBase={enrollBase}
					appBase={appBase}
					boundLabel={boundLabel}
					onBackToLicense={onOpenTunnel ? onGoHome : undefined}
					onOpenTunnel={onOpenTunnel}
					onClearDeviceBind={onClearDeviceBind}
					clearDeviceBindBusy={clearDeviceBindBusy}
				/>
			</div>
		</div>
	);
}
