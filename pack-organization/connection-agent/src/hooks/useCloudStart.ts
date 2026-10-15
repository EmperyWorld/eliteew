/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Cloud SPA Start: local entitlement + server preflight before product_open / OIDC.
 *
 * Invariants:
 * - Start CTA enabled only when canOpenCloudSpa sees real preflightOk (NCR-004).
 * - Eager licensePreflight after L7-confirmed channel (protected), not on first SOCKS alone.
 * - Re-runs when portal status code changes (channel_unconfirmed → protected).
 * - Click re-checks channel + preflight before product_open.
 * - Wave 7: native interactive OIDC must succeed before product_open (no soft-open).
 * - Rust product_open remains fail-closed without an unexpired native session.
 */

import { useCallback, useEffect, useState } from 'react';
import { canOpenCloudSpa } from '../lib/launcher/entitlementGate';
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

export function useCloudStart(opts: {
	enrollBase: string;
	versionOk: boolean;
	minVersion: string;
	entitlement: EntitlementStatusView | null;
	onlineBoundLabel: string | null;
	allowOnline: boolean | null;
	bindLicenseId: string | null;
	bindDeviceId: string | null;
	channelRestoreDone: boolean;
	productChannelListening: boolean;
	/** TunnelScreen code — triggers preflight retry when L7 confirms (protected). */
	productChannelCode: string | null;
	setLauncherDetail: (detail: string) => void;
	onLicenseKillSwitch?: (code: string, message: string) => void;
}) {
	const {
		enrollBase,
		versionOk,
		minVersion,
		entitlement,
		onlineBoundLabel: _onlineBoundLabel,
		allowOnline,
		bindLicenseId,
		bindDeviceId,
		channelRestoreDone,
		productChannelListening,
		productChannelCode,
		setLauncherDetail,
		onLicenseKillSwitch,
	} = opts;

	const [preflightOk, setPreflightOk] = useState(false);
	const [cloudGateDetail, setCloudGateDetail] = useState<string | null>(null);
	const [preflightPending, setPreflightPending] = useState(false);

	const runEagerLicensePreflight = useCallback(async (): Promise<void> => {
		if (!versionOk || !entitlement?.ok || allowOnline !== true) {
			setPreflightOk(false);
			setCloudGateDetail(null);
			setPreflightPending(false);
			return;
		}
		if (!channelRestoreDone) {
			setPreflightOk(false);
			setCloudGateDetail(null);
			setPreflightPending(true);
			return;
		}
		if (!productChannelListening) {
			setPreflightOk(false);
			setCloudGateDetail(null);
			setPreflightPending(false);
			return;
		}
		if (
			productChannelCode === 'reconnecting' ||
			productChannelCode === 'channel_unconfirmed'
		) {
			setPreflightOk(false);
			setCloudGateDetail(
				productChannelCode === 'channel_unconfirmed'
					? 'Канал не подтверждён. Нажмите «Проверить соединение и лицензию».'
					: null
			);
			setPreflightPending(productChannelCode === 'reconnecting');
			return;
		}
		if (productChannelCode !== 'protected' && productChannelCode !== 'socks_listening') {
			setPreflightOk(false);
			setCloudGateDetail(null);
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
			setCloudGateDetail('Нужна проверка лицензии');
			setPreflightPending(false);
			return;
		}
		const channel = await assertProductChannelReadyWithRecover();
		if (!channel.ok) {
			setPreflightOk(false);
			setCloudGateDetail(channel.detail);
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
			setCloudGateDetail(gate.ok ? null : gate.message);
		} catch (err) {
			setPreflightOk(false);
			setCloudGateDetail(
				err instanceof Error && err.message.trim()
					? err.message
					: 'Нужна проверка лицензии — нет связи с сервером'
			);
		} finally {
			setPreflightPending(false);
		}
	}, [
		allowOnline,
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

	const canOnlineStart = canOpenCloudSpa({
		versionOk,
		entitlementOk: Boolean(entitlement?.ok),
		allowOnline,
		preflightOk,
	});

	const handleStartAttempt = useCallback(async () => {
		if (!versionOk) {
			setLauncherDetail(`Запуск недоступен: нужна версия ≥ ${minVersion}`);
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
		if (allowOnline !== true) {
			setLauncherDetail(
				'Эта лицензия только для офлайн-режима — облачный стол недоступен'
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
			setCloudGateDetail(channel.detail);
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
			setCloudGateDetail(gate.message);
			setLauncherDetail(gate.message);
			return;
		}
		setPreflightOk(true);
		setCloudGateDetail(null);
		const channelBeforeOpen = await assertProductChannelReadyWithRecover();
		if (!channelBeforeOpen.ok) {
			setLauncherDetail(channelBeforeOpen.detail);
			return;
		}
		const native = await ensureNativeOidcBeforeProductOpen({
			client: 'emperyDesktop',
			licenseId: ids.licenseId,
			deviceId: ids.deviceId,
		});
		if (!native.nativeOk) {
			setLauncherDetail(native.detail ?? 'Вход не завершён. Приложение откроется после успешного входа.');
			return;
		}
		try {
			const opened = await productOpen({
				kind: 'connectedCloud',
				licenseId: ids.licenseId,
				deviceId: ids.deviceId,
			});
			setLauncherDetail(
				opened.ok
					? 'Открыт облачный стол'
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
				err instanceof Error ? err.message : 'Не удалось открыть облачный стол'
			);
		}
	}, [
		allowOnline,
		bindDeviceId,
		bindLicenseId,
		enrollBase,
		entitlement,
		minVersion,
		onLicenseKillSwitch,
		setLauncherDetail,
		versionOk,
	]);

	return {
		canOnlineStart,
		handleStartAttempt,
		refreshLicensePreflight: runEagerLicensePreflight,
		setPreflightOk,
		cloudGateDetail,
		preflightPending,
	};
}
