/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Linux WebKit sticky escalate recovery — clear software-compositing lag without shell.
 *
 * Invariants:
 * - Probe only after nativeReady; ignore not_linux / invoke failures quietly.
 * - Reset always followed by appRestart when cleared_restart_required.
 *
 * Related:
 * - lib/tauri-bridge/commands.ts webkitGraphics*
 * - documentation/product/desktop/DESKTOP-CLIENT-WEBKIT-LINUX-GRAPHICS.md
 */

import { useCallback, useEffect, useState } from 'react';
import {
	appRestart,
	webkitGraphicsReset,
	webkitGraphicsStatus,
} from '../lib/tauri-bridge/commands';

export function useWebkitGraphicsRecovery(opts: {
	nativeReady: boolean;
	setLauncherDetail: (detail: string) => void;
}) {
	const { nativeReady, setLauncherDetail } = opts;
	const [recoveryAvailable, setRecoveryAvailable] = useState(false);
	const [recoveryBusy, setRecoveryBusy] = useState(false);

	const refresh = useCallback(async () => {
		try {
			const status = await webkitGraphicsStatus();
			setRecoveryAvailable(Boolean(status.recovery_available));
		} catch {
			setRecoveryAvailable(false);
		}
	}, []);

	useEffect(() => {
		if (!nativeReady) return;
		void refresh();
	}, [nativeReady, refresh]);

	const handleRecovery = useCallback(async () => {
		setRecoveryBusy(true);
		try {
			setLauncherDetail('Восстанавливаем плавность интерфейса…');
			const result = await webkitGraphicsReset();
			if (result.code === 'already_ok') {
				setRecoveryAvailable(false);
				setLauncherDetail('Интерфейс уже в обычном режиме');
				return;
			}
			if (!result.ok) {
				setLauncherDetail(
					result.message || 'Не удалось восстановить плавность интерфейса'
				);
				return;
			}
			setLauncherDetail('Плавность восстановлена — перезапускаем…');
			setRecoveryAvailable(false);
			await appRestart();
		} catch (err) {
			setLauncherDetail(
				err instanceof Error
					? err.message
					: 'Не удалось восстановить плавность интерфейса'
			);
		} finally {
			setRecoveryBusy(false);
		}
	}, [setLauncherDetail]);

	return {
		recoveryAvailable,
		recoveryBusy,
		handleRecovery,
		refreshGraphicsRecovery: refresh,
	};
}
