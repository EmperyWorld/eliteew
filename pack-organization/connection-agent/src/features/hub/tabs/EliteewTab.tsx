/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Journey Hub EliteEW tab — Start / FoFline / OfflineShell / denylist (from ShellStep).
 *
 * Invariants:
 * - No dense chip wall above the fold (chips → Ещё in later waves).
 * - Capability-gated Start via living canOnlineStart / canFoflineStart.
 * - FoFline-only seats: FoFline is the filled primary (not a disabled Cloud CTA).
 * - Offline-only seats: OfflineShell is primary (not cloud LauncherScreen).
 *
 * Related:
 * - DESKTOP-CLIENT-LAUNCHER-JOURNEY.md §5.1
 * - lib/launcher/journey/hubIa.ts
 */

import type { ReactNode } from 'react';
import { FoflineSpaPackStatus } from '../../fofline/FoflineSpaPackStatus';
import { LauncherScreen } from '../../launcher/LauncherScreen';
import { OfflineShell } from '../../shell/OfflineShell';
import { shouldBlockShellForDenylist } from '../../shell/denylistGate';
import { APP_VERSION } from '../../../lib/launcher/appVersion';
import {
	ELITEEW_SITE_URL,
	resolveEliteewLauncherLayout,
	resolveEliteewPrimaryCta,
} from '../../../lib/launcher/journey';
import type {
	DenylistStatusView,
	EntitlementStatusView,
} from '../../../lib/tauri-bridge/commands';
import type { FoflineSpaPackUi } from '../../../hooks/useFoflineSpaPack';
import { humanizeEntitlement } from '../../../lib/ui/statusCopy';

export type EliteewTabProps = {
	appBase: string;
	entitlement: EntitlementStatusView | null;
	versionOk: boolean;
	canOnlineStart: boolean;
	canFoflineStart: boolean;
	allowOnline: boolean | null;
	allowFofline: boolean | null;
	launcherDetail: string;
	denylist: DenylistStatusView | null;
	foflineSpaPack: FoflineSpaPackUi | null;
	cloudGateDetail?: string | null;
	foflineGateDetail?: string | null;
	preflightPending?: boolean;
	onCheckChannel?: () => void;
	channelCheckBusy?: boolean;
	onStart: () => void;
	onFoflineStart?: () => void;
	onFoflineSpaPackRetry?: () => void;
	onFoflineSpaPackUpdate?: () => void;
	onRefreshDenylist: () => void;
	onGoHome: () => void;
	onOpenSite?: () => void;
};

export function EliteewTab(props: EliteewTabProps) {
	const {
		appBase,
		entitlement,
		versionOk,
		canOnlineStart,
		canFoflineStart,
		allowOnline,
		allowFofline,
		launcherDetail,
		cloudGateDetail,
		foflineGateDetail,
		preflightPending,
		onCheckChannel,
		channelCheckBusy = false,
		denylist,
		foflineSpaPack,
		onStart,
		onFoflineStart,
		onFoflineSpaPackRetry,
		onFoflineSpaPackUpdate,
		onRefreshDenylist,
		onGoHome,
		onOpenSite,
	} = props;

	const denylisted = shouldBlockShellForDenylist(denylist?.revoked);
	const offlineOnly =
		Boolean(entitlement?.ok) &&
		allowOnline !== true &&
		allowFofline !== true;
	const primaryCta = resolveEliteewPrimaryCta({
		versionOk,
		entitlementOk: Boolean(entitlement?.ok),
		denylisted,
		allowOnline: allowOnline === true,
		allowFofline: allowFofline === true,
		offlineOnly,
	});

	const launch = resolveEliteewLauncherLayout({
		primaryCta,
		allowOnline: allowOnline === true,
		allowFofline: allowFofline === true,
		canOnlineStart,
		canFoflineStart,
		preflightPending: Boolean(preflightPending),
		denylisted,
		entitlementOk: Boolean(entitlement?.ok),
		hasCheckChannel: Boolean(onCheckChannel),
		versionLabel: APP_VERSION,
	});
	const foflinePrimary = launch.primaryKind === 'fofline';
	const foflinePackReady = foflineSpaPack?.state === 'ready';
	const primaryCanStart = foflinePrimary
		? Boolean(onFoflineStart) &&
			canFoflineStart &&
			foflinePackReady &&
			!denylisted
		: canOnlineStart && !denylisted;
	const primaryOnStart = foflinePrimary
		? (onFoflineStart ?? (() => undefined))
		: onStart;

	const startDisabledReason =
		primaryCta === 'blocked_denylist'
			? 'Лицензия отозвана — запуск недоступен.'
			: primaryCta === 'blocked_version'
				? launcherDetail
				: primaryCta === 'blocked_capability'
					? foflinePrimary
						? 'Нет права запуска FoFline на этом месте.'
						: 'Нет права запуска облачного рабочего стола на этом месте.'
					: entitlement?.ok && !denylisted && !primaryCanStart
						? preflightPending
							? foflinePrimary
								? 'Проверяем лицензию для запуска FoFline…'
								: 'Проверяем лицензию для облачного запуска…'
							: foflinePrimary && canFoflineStart && !foflinePackReady
								? 'Рабочая среда FoFline ещё не готова на этом устройстве.'
								: (foflinePrimary ? foflineGateDetail : cloudGateDetail) ||
									(foflinePrimary
										? 'Запуск FoFline пока недоступен — проверьте соединение или нажмите кнопку ещё раз.'
										: 'Облачный запуск пока недоступен — проверьте соединение или нажмите кнопку ещё раз.')
						: null;

	const offlineCatalog =
		entitlement?.ok && !denylisted ? (
			<OfflineShell
				edition={entitlement.edition ?? 'client'}
				profileId={entitlement.profile_id ?? null}
				apps={entitlement.apps ?? []}
				licenseId={entitlement.license_id ?? null}
				appVersion={APP_VERSION}
				appBase={appBase}
				detail="Офлайн-старт по локальной лицензии. Откройте приложение из каталога — панели работают на устройстве."
			/>
		) : null;

	const cloudLaunch = (
		<>
			<LauncherScreen
				versionLabel={APP_VERSION}
				lead={launch.lead}
				canStart={primaryCanStart}
				canCheckUpdate={false}
				onStart={primaryOnStart}
				onCheckUpdate={() => undefined}
				detail={startDisabledReason ?? launcherDetail}
				startLabel={launch.primaryLabel}
				canFoflineStart={
					canFoflineStart && foflinePackReady && !denylisted
				}
				onFoflineStart={
					launch.showFoflineSecondary ? onFoflineStart : undefined
				}
				foflineStartLabel="Открыть FoFline"
			/>
			{launch.showChannelRecover ? (
				<div className="actions" style={{ marginTop: '0.75rem' }}>
					<button
						type="button"
						className="secondary"
						disabled={channelCheckBusy}
						onClick={onCheckChannel}
					>
						{channelCheckBusy
							? 'Проверка…'
							: 'Проверить соединение и лицензию'}
					</button>
				</div>
			) : null}
			{foflineSpaPack ? (
				<FoflineSpaPackStatus
					pack={foflineSpaPack}
					onRetry={
						onFoflineSpaPackRetry
							? () => onFoflineSpaPackRetry()
							: undefined
					}
					onUpdate={
						onFoflineSpaPackUpdate
							? () => onFoflineSpaPackUpdate()
							: undefined
					}
				/>
			) : null}
		</>
	);

	let primary: ReactNode;
	let secondary: ReactNode;

	if (denylisted && entitlement?.ok) {
		primary = (
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
		);
		secondary = null;
	} else if (primaryCta === 'open_offline' && offlineCatalog) {
		primary = offlineCatalog;
		secondary = (
			<section className="panel">
				<h2>Облачный рабочий стол</h2>
				<p className="muted">
					На этом месте доступны только офлайн-приложения. Облачный запуск не
					выдан в лицензии.
				</p>
				{onOpenSite ? (
					<div className="actions">
						<button type="button" className="secondary" onClick={onOpenSite}>
							Сайт EliteEW
						</button>
					</div>
				) : null}
			</section>
		);
	} else if (entitlement?.ok) {
		primary = (
			<>
				{cloudLaunch}
				{onOpenSite ? (
					<p className="muted" style={{ marginTop: '0.75rem' }}>
						<button type="button" className="secondary" onClick={onOpenSite}>
							Сайт EliteEW
						</button>
						<span className="muted"> · {ELITEEW_SITE_URL}</span>
					</p>
				) : null}
			</>
		);
		secondary = offlineCatalog;
	} else {
		primary = (
			<>
				{cloudLaunch}
				{onOpenSite ? (
					<p className="muted" style={{ marginTop: '0.75rem' }}>
						<button type="button" className="secondary" onClick={onOpenSite}>
							Сайт EliteEW
						</button>
						<span className="muted"> · {ELITEEW_SITE_URL}</span>
					</p>
				) : null}
			</>
		);
		secondary = (
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
		);
	}

	return (
		<div
			className="shell-split"
			data-layout="eliteew-tab"
			data-cta={primaryCta}
		>
			<div className="shell-primary shell-dashboard">{primary}</div>
			{secondary ? <div className="shell-secondary">{secondary}</div> : null}
		</div>
	);
}
