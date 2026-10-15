/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure status-chip labels for ConnectionStatusBar.
 *
 * Related:
 * - features/shell/ConnectionStatusBar.tsx
 * - lib/ui/statusCopy.ts
 */

import { humanizeWg } from '../ui/statusCopy';
import type { WgPortalStatus } from '../tauri-bridge/commands';

export function tunnelChipValue(wg: WgPortalStatus | null): string {
	if (!wg) return 'Не проверен';
	if (wg.code === 'protected') return 'Защищено';
	if (wg.code === 'reconnecting') return 'Восстанавливаем';
	if (wg.code === 'channel_unstable' || wg.code === 'channel_unconfirmed') {
		return 'Соединение нестабильно';
	}
	if (wg.code === 'socks_listening' || wg.code === 'socks_up') {
		return 'Подключение';
	}
	if (wg.code === 'idle') return 'Не подключён';
	if (wg.ok) return wg.unit_active ? 'Активен' : 'Конфиг есть';
	return humanizeWg(wg.code);
}

export function licenseChipValue(opts: {
	entitlementOk: boolean | null | undefined;
	hasEntitlement: boolean;
	onlineBoundLabel: string | null;
}): string {
	if (opts.entitlementOk) return 'Подтверждена';
	if (opts.onlineBoundLabel) return 'Онлайн-сессия';
	if (opts.hasEntitlement) return 'Нужна активация';
	return 'Проверка…';
}

export function updateChipValue(opts: {
	updaterAvailable: string | null;
	updateCheckBusy: boolean;
	updaterMessage: string;
}): string {
	if (opts.updaterAvailable) return `Есть ${opts.updaterAvailable}`;
	if (opts.updateCheckBusy) return 'Проверка…';
	if (opts.updaterMessage.includes('актуальн')) return 'Актуальна';
	if (opts.updaterMessage.includes('ещё не')) return 'Не проверяли';
	return 'См. ниже';
}
