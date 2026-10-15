/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * License redeem + bind ids for cloud Start / session assert (#015).
 */

import { useCallback, useState } from 'react';
import { redeemLicense } from '../lib/enroll/redeemLicense';
import { persistBindIds } from '../lib/launcher/bindSession';
import { persistLicenseCapabilities } from '../lib/launcher/licenseCapabilities';
import type { LauncherStep } from '../lib/launcher/stepGates';
import {
	ensureDeviceIdentity,
	entitlementImportJson,
	type EntitlementStatusView,
} from '../lib/tauri-bridge/commands';
import { editionLabelRu, humanizeEntitlement } from '../lib/ui/statusCopy';

export function useLicenseRedeem(opts: {
	enrollBase: string;
	setEntitlement: (ent: EntitlementStatusView) => void;
	setStep: (step: LauncherStep) => void;
	setLauncherDetail: (detail: string) => void;
	refreshDenylist: () => Promise<unknown>;
}) {
	const {
		enrollBase,
		setEntitlement,
		setStep,
		setLauncherDetail,
		refreshDenylist,
	} = opts;

	const [licenseKey, setLicenseKey] = useState('');
	const [licenseBusy, setLicenseBusy] = useState(false);
	const [licenseStatus, setLicenseStatus] = useState(
		'Введите ключ и нажмите «Активировать». При успехе доступ сохранится и для офлайн-режима.'
	);
	const [onlineBoundLabel, setOnlineBoundLabel] = useState<string | null>(null);
	const [bindLicenseId, setBindLicenseId] = useState<string | null>(null);
	const [bindDeviceId, setBindDeviceId] = useState<string | null>(null);
	const [allowOnline, setAllowOnline] = useState<boolean | null>(null);
	const [allowFofline, setAllowFofline] = useState<boolean | null>(null);

	const handleRedeem = useCallback(async () => {
		setLicenseBusy(true);
		try {
			const identity = await ensureDeviceIdentity();
			const result = await redeemLicense({
				enrollBase,
				licenseKey,
				devicePubkey: identity.device_pubkey,
				machineFingerprint: identity.machine_fingerprint,
			});
			if (!result.ok) {
				setLicenseStatus(humanizeEntitlement(result.code, result.message));
				return;
			}
			setLicenseStatus(`Активировано · ${editionLabelRu(result.edition)}`);
			setBindLicenseId(result.license_id);
			setBindDeviceId(result.device_id);
			persistBindIds(result.license_id, result.device_id);
			if (typeof result.allow_online === 'boolean') {
				setAllowOnline(result.allow_online);
			}
			const fofline =
				typeof result.allow_fofline === 'boolean' ? result.allow_fofline : null;
			setAllowFofline(fofline);
			persistLicenseCapabilities({
				licenseId: result.license_id,
				allowOffline:
					typeof result.allow_offline === 'boolean'
						? result.allow_offline
						: null,
				allowOnline:
					typeof result.allow_online === 'boolean' ? result.allow_online : null,
				...(typeof fofline === 'boolean' ? { allowFofline: fofline } : {}),
			});
			setOnlineBoundLabel(
				`${editionLabelRu(result.edition)} · ${result.device_id.slice(0, 8)}…`
			);

			if (result.entitlement) {
				try {
					const ent = await entitlementImportJson(
						JSON.stringify(result.entitlement)
					);
					setEntitlement(ent);
					if (ent.ok) {
						setStep('shell');
						setLauncherDetail(humanizeEntitlement(ent.code, ent.message));
						await refreshDenylist();
						return;
					}
					setLicenseStatus(
						`Активировано, но локальный пакет доступа: ${ent.code}: ${ent.message}`
					);
				} catch (err) {
					setLicenseStatus(
						`Активировано, но сохранить локальный пакет не удалось: ${
							err instanceof Error ? err.message : String(err)
						}`
					);
				}
			} else {
				setLicenseStatus(
					`${editionLabelRu(result.edition)} привязан онлайн. Для офлайна без сети импортируйте пакет места.`
				);
			}
			setStep('shell');
			await refreshDenylist();
		} catch (err) {
			setLicenseStatus(
				err instanceof Error ? err.message : 'Не удалось активировать лицензию'
			);
		} finally {
			setLicenseBusy(false);
		}
	}, [
		enrollBase,
		licenseKey,
		refreshDenylist,
		setEntitlement,
		setLauncherDetail,
		setStep,
	]);

	return {
		licenseKey,
		setLicenseKey,
		licenseBusy,
		setLicenseBusy,
		licenseStatus,
		setLicenseStatus,
		onlineBoundLabel,
		setOnlineBoundLabel,
		bindLicenseId,
		setBindLicenseId,
		bindDeviceId,
		setBindDeviceId,
		allowOnline,
		setAllowOnline,
		allowFofline,
		setAllowFofline,
		handleRedeem,
	};
}
