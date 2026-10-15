/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * FoFline SPA Start via product_open — L3 local pack origin (foflineNative).
 *
 * Invariants:
 * - Fail closed when allowFofline is not true — honest detail, no fake success.
 * - Start CTA enabled only when canOpenFoflineSpa sees real preflightOk (NCR-004).
 * - Eager licensePreflight after L7-confirmed channel; re-runs when portal code → protected.
 * - Click: channel recover → identity → preflight → pack ready → channel → native OIDC → product_open.
 * - Native Start is always foflineLocal — no FE remote URL / lying «удалённый режим».
 * - Pack not ready → fail-closed (retail remote Start is not a product path).
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §5 / §9 / W2 / W5 / L3 / L5
 */

import { useCallback, useEffect, useState } from 'react';
import { canOpenFoflineSpa } from '../lib/launcher/entitlementGate';
import { resolveStartBindIds } from '../lib/launcher/bindHydration';
import { readPersistedBindIds } from '../lib/launcher/bindSession';
import { licensePreflight } from '../lib/enroll/licensePreflight';
import { startLicenseHeartbeat } from '../lib/enroll/licenseHeartbeatLoop';
import {
	assertProductChannelReadyWithRecover,
	humanizeProductOpenFailure,
} from '../lib/tunnel/productChannelPreflight';
import { ensureNativeOidcBeforeProductOpen } from '../lib/launcher/nativeOidcHubSession';
import {
	ensureDeviceIdentity,
	productOpen,
	type EntitlementStatusView,
} from '../lib/tauri-bridge/commands';
import { humanizeFoflineSpaPack } from '../lib/ui/statusCopy';
import type { FoflineSpaPackUi } from './useFoflineSpaPack';

export function useFoflineStart(opts: {
	enrollBase: string;
	versionOk: boolean;
	minVersion: string;
	entitlement: EntitlementStatusView | null;
	allowFofline: boolean | null;
	bindLicenseId: string | null;
	bindDeviceId: string | null;
	channelRestoreDone: boolean;
	productChannelListening: boolean;
	productChannelCode: string | null;
	spaPack: FoflineSpaPackUi | null;
	setLauncherDetail: (detail: string) => void;
	onLicenseKillSwitch?: (code: string, message: string) => void;
}) {
	const {
		enrollBase,
		versionOk,
		minVersion,
		entitlement,
		allowFofline,
		bindLicenseId,
		bindDeviceId,
		channelRestoreDone,
		productChannelListening,
		productChannelCode,
		spaPack,
		setLauncherDetail,
		onLicenseKillSwitch,
	} = opts;

	const packReady = spaPack?.state === 'ready';
	const [preflightOk, setPreflightOk] = useState(false);
	const [foflineGateDetail, setFoflineGateDetail] = useState<string | null>(
		null
	);
	const [preflightPending, setPreflightPending] = useState(false);

	const runEagerLicensePreflight = useCallback(async (): Promise<void> => {
		if (!versionOk || !entitlement?.ok || allowFofline !== true) {
			setPreflightOk(false);
			setFoflineGateDetail(null);
			setPreflightPending(false);
			return;
		}
		if (!channelRestoreDone) {
			setPreflightOk(false);
			setFoflineGateDetail(null);
			setPreflightPending(true);
			return;
		}
		if (!productChannelListening) {
			setPreflightOk(false);
			setFoflineGateDetail(null);
			setPreflightPending(false);
			return;
		}
		if (
			productChannelCode === 'reconnecting' ||
			productChannelCode === 'channel_unconfirmed'
		) {
			setPreflightOk(false);
			setFoflineGateDetail(
				productChannelCode === 'channel_unconfirmed'
					? 'Канал не подтверждён. Нажмите «Проверить соединение и лицензию».'
					: null
			);
			setPreflightPending(productChannelCode === 'reconnecting');
			return;
		}
		if (
			productChannelCode !== 'protected' &&
			productChannelCode !== 'socks_listening'
		) {
			setPreflightOk(false);
			setFoflineGateDetail(null);
			setPreflightPending(false);
			return;
		}
		const ids = resolveStartBindIds({
			bindLicenseId,
			bindDeviceId,
			entitlement,
			persisted: readPersistedBindIds(),
		});
		if (!ids.licenseId) {
			setPreflightOk(false);
			setFoflineGateDetail('Нужна проверка лицензии');
			setPreflightPending(false);
			return;
		}
		const channel = await assertProductChannelReadyWithRecover();
		if (!channel.ok) {
			setPreflightOk(false);
			setFoflineGateDetail(channel.detail);
			setPreflightPending(false);
			return;
		}
		setPreflightPending(true);
		try {
			const identity = await ensureDeviceIdentity();
			const gate = await licensePreflight(enrollBase, {
				licenseId: ids.licenseId,
				deviceId: ids.deviceId,
				machineFingerprint: identity.machine_fingerprint,
			});
			setPreflightOk(gate.ok);
			setFoflineGateDetail(gate.ok ? null : gate.message);
		} catch (err) {
			setPreflightOk(false);
			setFoflineGateDetail(
				err instanceof Error && err.message.trim()
					? err.message
					: 'Нужна проверка лицензии — нет связи с сервером'
			);
		} finally {
			setPreflightPending(false);
		}
	}, [
		allowFofline,
		bindDeviceId,
		bindLicenseId,
		channelRestoreDone,
		enrollBase,
		entitlement,
		productChannelCode,
		productChannelListening,
		versionOk,
	]);

	useEffect(() => {
		void runEagerLicensePreflight();
	}, [runEagerLicensePreflight]);

	const canFoflineStart = canOpenFoflineSpa({
		versionOk,
		entitlementOk: Boolean(entitlement?.ok),
		allowFofline,
		preflightOk,
	});

	const handleFoflineStartAttempt = useCallback(async () => {
		if (!versionOk) {
			setLauncherDetail(
				`Запуск FoFline недоступен: нужна версия ≥ ${minVersion}`
			);
			return;
		}
		if (!entitlement?.ok) {
			setLauncherDetail(
				entitlement?.code === 'license_revoked' ||
					entitlement?.code === 'revoked' ||
					entitlement?.code === 'device_revoked'
					? 'Доступ отозван'
					: entitlement?.code === 'expired' ||
							entitlement?.code === 'license_expired' ||
							entitlement?.code === 'clock_rollback'
						? 'Срок лицензии истёк'
						: 'Сначала активируйте лицензию или импортируйте пакет места'
			);
			return;
		}
		if (allowFofline !== true) {
			setLauncherDetail(
				'Эта лицензия не включает FoFline — обратитесь к оператору контракта'
			);
			return;
		}

		const ids = resolveStartBindIds({
			bindLicenseId,
			bindDeviceId,
			entitlement,
			persisted: readPersistedBindIds(),
		});
		if (!ids.licenseId) {
			setLauncherDetail('Нужна проверка лицензии');
			return;
		}
		const channel = await assertProductChannelReadyWithRecover();
		if (!channel.ok) {
			setPreflightOk(false);
			setFoflineGateDetail(channel.detail);
			setLauncherDetail(channel.detail);
			return;
		}
		let machineFingerprint: string | null = null;
		try {
			const identity = await ensureDeviceIdentity();
			machineFingerprint = identity.machine_fingerprint;
		} catch {
			setLauncherDetail('Не удалось прочитать идентификатор устройства');
			return;
		}
		const gate = await licensePreflight(enrollBase, {
			licenseId: ids.licenseId,
			deviceId: ids.deviceId,
			machineFingerprint,
		});
		if (!gate.ok) {
			setPreflightOk(false);
			setFoflineGateDetail(gate.message);
			setLauncherDetail(gate.message);
			return;
		}
		setPreflightOk(true);
		setFoflineGateDetail(null);
		if (!packReady) {
			setLauncherDetail(
				humanizeFoflineSpaPack(
					spaPack?.code || 'pack_not_ready',
					spaPack?.message,
					{
						state: spaPack?.state,
						appBuildId: spaPack?.appBuildId,
						remoteAppBuildId: spaPack?.remoteAppBuildId,
						updateAvailable: spaPack?.updateAvailable,
					}
				)
			);
			return;
		}

		const channelBeforeOpen = await assertProductChannelReadyWithRecover();
		if (!channelBeforeOpen.ok) {
			setLauncherDetail(channelBeforeOpen.detail);
			return;
		}

		const native = await ensureNativeOidcBeforeProductOpen({
			client: 'emperyFofline',
			licenseId: ids.licenseId,
			deviceId: ids.deviceId,
		});
		if (!native.nativeOk) {
			setLauncherDetail(native.detail ?? 'Вход не завершён. Приложение откроется после успешного входа.');
			return;
		}

		try {
			const opened = await productOpen({
				kind: 'foflineLocal',
				licenseId: ids.licenseId,
				deviceId: ids.deviceId,
			});
			if (!opened.ok && opened.code === 'w_transport_proxy_required') {
				setLauncherDetail(
					humanizeProductOpenFailure(opened.code, opened.message)
				);
				return;
			}
			setLauncherDetail(
				opened.ok
					? 'Открыт FoFline'
					: humanizeProductOpenFailure(opened.code, opened.message)
			);
			if (opened.ok) {
				startLicenseHeartbeat({
					enrollBase,
					licenseId: ids.licenseId,
					deviceId: ids.deviceId,
					machineFingerprint,
					onDeny: (code, message) => {
						setPreflightOk(false);
						onLicenseKillSwitch?.(code, message);
					},
				});
			}
		} catch (err) {
			setLauncherDetail(
				err instanceof Error ? err.message : 'Не удалось открыть FoFline'
			);
		}
	}, [
		allowFofline,
		bindDeviceId,
		bindLicenseId,
		enrollBase,
		entitlement,
		minVersion,
		onLicenseKillSwitch,
		packReady,
		setLauncherDetail,
		spaPack?.appBuildId,
		spaPack?.code,
		spaPack?.message,
		spaPack?.remoteAppBuildId,
		spaPack?.state,
		spaPack?.updateAvailable,
		versionOk,
	]);

	return {
		canFoflineStart,
		handleFoflineStartAttempt,
		refreshLicensePreflight: runEagerLicensePreflight,
		foflineGateDetail,
		preflightPending,
	};
}
