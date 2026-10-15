/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Wave K3: secondary CTA from O5 device panels into cloud Desktop via spa_deep_link.
 *
 * Invariants:
 * - No-op when policy spa_deep_link is false; uses product_open (not kernel Webview).
 * - Server preflight + heartbeat (Full Security) — same as Cloud Start.
 * - Honest status when APP_BASE / tunnel unavailable.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-KERNEL-OFFLINE-MOUNT-BRIDGE.md
 */

import { useState } from 'react';
import { getDesktopClientBases } from '../../../lib/config/bases';
import { startLicenseHeartbeat } from '../../../lib/enroll/licenseHeartbeatLoop';
import { licensePreflight } from '../../../lib/enroll/licensePreflight';
import { isSpaDeepLinkMount } from '../../../lib/kernel/kernelOfflineMount';
import { readPersistedBindIds } from '../../../lib/launcher/bindSession';
import { ensureNativeOidcBeforeProductOpen } from '../../../lib/launcher/nativeOidcHubSession';
import {
	ensureDeviceIdentity,
	entitlementStatus,
	productOpen,
} from '../../../lib/tauri-bridge/commands';
import {
	assertProductChannelReady,
	humanizeProductOpenFailure,
} from '../../../lib/tunnel/productChannelPreflight';

type Props = {
	appId: string;
	appBase: string;
	label?: string;
	onLicenseKillSwitch?: (code: string, message: string) => void;
};

export function OfflineSpaDeepLinkCta({
	appId,
	appBase,
	label = 'Открыть в облачном столе',
	onLicenseKillSwitch,
}: Props) {
	const [busy, setBusy] = useState(false);
	const [detail, setDetail] = useState<string | null>(null);

	if (!isSpaDeepLinkMount(appId)) {
		return null;
	}

	async function handleOpen() {
		if (!isSpaDeepLinkMount(appId)) {
			setDetail('Облачный стол недоступен в этом билде (spa_deep_link).');
			return;
		}
		setBusy(true);
		setDetail(null);
		try {
			const ent = await entitlementStatus();
			if (!ent.ok) {
				setDetail(
					ent.code === 'expired' || ent.code === 'clock_rollback'
						? 'Срок лицензии истёк'
						: 'Сначала активируйте лицензию'
				);
				return;
			}
			if (ent.allow_online !== true) {
				setDetail(
					'Эта лицензия только для офлайн-режима — облачный стол недоступен'
				);
				return;
			}
			const persisted = readPersistedBindIds();
			const licenseId =
				ent.license_id?.trim() || persisted?.licenseId?.trim() || '';
			const deviceId =
				ent.device_id?.trim() || persisted?.deviceId?.trim() || null;
			if (!licenseId) {
				setDetail('Нужна проверка лицензии');
				return;
			}
			const identity = await ensureDeviceIdentity();
			const { enrollBase } = getDesktopClientBases();
			const gate = await licensePreflight(enrollBase, {
				licenseId,
				deviceId,
				machineFingerprint: identity.machine_fingerprint,
			});
			if (!gate.ok) {
				setDetail(gate.message);
				return;
			}
			if (gate.allowOnline === false) {
				setDetail(
					'Эта лицензия только для офлайн-режима — облачный стол недоступен'
				);
				return;
			}
			const channel = await assertProductChannelReady();
			if (!channel.ok) {
				setDetail(channel.detail);
				return;
			}
			const native = await ensureNativeOidcBeforeProductOpen({
				client: 'emperyDesktop',
				licenseId,
				deviceId,
			});
			if (!native.nativeOk) {
				setDetail(
					native.detail ??
						'Вход не завершён. Приложение откроется после успешного входа.'
				);
				return;
			}
			const result = await productOpen({
				kind: 'spaDeepLink',
				appId,
				licenseId,
				deviceId,
			});
			if (result.ok) {
				startLicenseHeartbeat({
					enrollBase,
					licenseId,
					deviceId,
					machineFingerprint: identity.machine_fingerprint,
					onDeny: (code, message) => {
						onLicenseKillSwitch?.(code, message);
						setDetail(message);
					},
				});
				setDetail('Открыт облачный стол');
			} else {
				setDetail(
					humanizeProductOpenFailure(result.code, result.message) ||
						'Не удалось открыть облачный стол — проверьте туннель и APP_BASE.'
				);
			}
		} catch (err) {
			setDetail(
				err instanceof Error
					? err.message
					: 'Не удалось открыть облачный стол'
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="offline-spa-deeplink">
			<div className="actions">
				<button
					type="button"
					className="secondary"
					disabled={busy}
					onClick={() => void handleOpen()}
				>
					{busy ? 'Открытие…' : label}
				</button>
			</div>
			{detail ? (
				<p className="status" role="status">
					{detail}
				</p>
			) : (
				<p className="muted">
					Нужны туннель и доступ к {appBase || 'облачному столу'}. На устройстве
					панель выше остаётся рабочей без сети.
				</p>
			)}
		</div>
	);
}
