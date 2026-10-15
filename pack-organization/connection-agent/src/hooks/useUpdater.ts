/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * OTA updater check / install / restart handlers for shell.
 * Linux RPM: auto signed OTA, or recovery RPM install when signing gate is broken.
 * Retail users never open a browser or run shell tips.
 *
 * Invariants:
 * - Install CTA still gated on native update_available.
 * - Auto-apply / recovery only when detectBuildChannel() === 'rpm'.
 * - Missing/invalid signing configuration never falls through to privileged recovery.
 *
 * Related:
 * - documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §OTA
 */

import { useCallback, useRef, useState } from 'react';
import { detectBuildChannel } from '../lib/enroll/reportRuntimePresence';
import {
	appRestart,
	updaterCheck,
	updaterInstall,
	updaterRecoveryInstall,
} from '../lib/tauri-bridge/commands';
import { humanizeUpdater } from '../lib/ui/statusCopy';

export function useUpdater(opts: {
	setLauncherDetail: (detail: string) => void;
	/**
	 * Journey W4: when false for an available version, skip silent Linux install
	 * (show Релизы notes instead). Omit → historical auto-apply behavior.
	 */
	maySilentAutoApply?: (availableVersion: string) => boolean;
}) {
	const { setLauncherDetail, maySilentAutoApply } = opts;
	const [updaterMessage, setUpdaterMessage] = useState(
		'Обновления ещё не проверяли'
	);
	const [updaterAvailable, setUpdaterAvailable] = useState<string | null>(null);
	const [updaterNeedsRestart, setUpdaterNeedsRestart] = useState(false);
	const [updateRestartBusy, setUpdateRestartBusy] = useState(false);
	const [updateCheckBusy, setUpdateCheckBusy] = useState(false);
	const [updateInstallBusy, setUpdateInstallBusy] = useState(false);
	const autoApplyInFlight = useRef(false);

	const handleAppRestart = useCallback(async () => {
		setUpdateRestartBusy(true);
		setLauncherDetail('Перезапуск приложения…');
		try {
			await appRestart();
		} catch (err) {
			setUpdateRestartBusy(false);
			setUpdaterMessage(
				err instanceof Error
					? err.message
					: 'Не удалось перезапустить приложение'
			);
		}
	}, [setLauncherDetail]);

	const handleUpdateInstall = useCallback(async () => {
		setUpdateInstallBusy(true);
		try {
			const result = await updaterInstall();
			const human = humanizeUpdater(result.code, result.message);
			setUpdaterMessage(human);
			setLauncherDetail(human);
			if (result.code === 'installed' && result.ok) {
				setUpdaterAvailable(null);
				setUpdaterNeedsRestart(true);
				return true;
			}
			if (result.code !== 'update_available' && result.ok) {
				setUpdaterAvailable(null);
				setUpdaterNeedsRestart(false);
			}
			return false;
		} catch (err) {
			setUpdaterMessage(
				err instanceof Error ? err.message : 'Не удалось установить обновление'
			);
			return false;
		} finally {
			setUpdateInstallBusy(false);
		}
	}, [setLauncherDetail]);

	const handleRecoveryInstall = useCallback(async () => {
		setUpdateInstallBusy(true);
		try {
			setLauncherDetail('Устанавливаем обновление…');
			setUpdaterMessage('Устанавливаем обновление…');
			const result = await updaterRecoveryInstall();
			const human = humanizeUpdater(result.code, result.message);
			setUpdaterMessage(human);
			setLauncherDetail(human);
			if (result.code === 'installed' && result.ok) {
				setUpdaterAvailable(null);
				setUpdaterNeedsRestart(true);
				return true;
			}
			return false;
		} catch (err) {
			setUpdaterMessage(
				err instanceof Error ? err.message : 'Не удалось установить обновление'
			);
			return false;
		} finally {
			setUpdateInstallBusy(false);
		}
	}, [setLauncherDetail]);

	const handleUpdateCheck = useCallback(async () => {
		setUpdateCheckBusy(true);
		try {
			const result = await updaterCheck();
			const human = humanizeUpdater(result.code, result.message);
			setUpdaterMessage(human);
			const available =
				result.code === 'update_available'
					? (result.available_version ?? null)
					: null;
			setUpdaterAvailable(available);
			if (result.code === 'update_available') {
				setUpdaterNeedsRestart(false);
			}
			if (
				result.code === 'update_available' ||
				result.code === 'up_to_date' ||
				result.code === 'offline_skip' ||
				result.code === 'not_configured' ||
				result.code === 'signing_required'
			) {
				setLauncherDetail(human);
			}
			return { available, code: result.code };
		} catch (err) {
			setUpdaterAvailable(null);
			setUpdaterMessage(
				err instanceof Error ? err.message : 'Не удалось проверить обновления'
			);
			return { available: null as string | null, code: 'check_failed' };
		} finally {
			setUpdateCheckBusy(false);
		}
	}, [setLauncherDetail]);

	/** Linux: signed OTA or in-app RPM recovery — never browser / shell tips. */
	const handleUpdateCheckAndAutoApply = useCallback(async () => {
		if (autoApplyInFlight.current) return;
		autoApplyInFlight.current = true;
		try {
			if (detectBuildChannel() !== 'rpm') {
				await handleUpdateCheck();
				return;
			}
			const { available, code } = await handleUpdateCheck();
			if (code === 'signing_required' || code === 'updater_build_failed') {
				return;
			}
			if (!available) return;
			if (maySilentAutoApply && !maySilentAutoApply(available)) {
				setLauncherDetail(
					`Доступно обновление ${available}. Откройте раздел «Релизы».`
				);
				setUpdaterMessage(
					`Доступно обновление ${available} — см. «Релизы».`
				);
				return;
			}
			setLauncherDetail(
				`Устанавливаем обновление ${available} для стабильной работы…`
			);
			setUpdaterMessage(
				`Устанавливаем обновление ${available} для стабильной работы…`
			);
			let installed = await handleUpdateInstall();
			if (!installed) {
				installed = await handleRecoveryInstall();
			}
			if (!installed) return;
			setLauncherDetail('Обновление установлено — перезапускаем…');
			setUpdaterMessage('Обновление установлено — перезапускаем…');
			await handleAppRestart();
		} finally {
			autoApplyInFlight.current = false;
		}
	}, [
		handleAppRestart,
		handleRecoveryInstall,
		handleUpdateCheck,
		handleUpdateInstall,
		maySilentAutoApply,
	]);

	return {
		updaterMessage,
		updaterAvailable,
		updaterNeedsRestart,
		updateRestartBusy,
		updateCheckBusy,
		updateInstallBusy,
		handleUpdateCheck: async () => {
			const r = await handleUpdateCheck();
			return r.available;
		},
		handleUpdateCheckAndAutoApply,
		handleUpdateInstall,
		handleAppRestart,
	};
}
