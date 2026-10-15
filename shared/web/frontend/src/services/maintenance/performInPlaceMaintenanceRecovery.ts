/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * In-place recovery after maintenance/outage when SPA bundle already matches server — no hard tab reload.
 *
 * Invariants:
 * - Clears reload hold only after `/api/health` and maintenance API confirm recovery.
 * - Best-effort Socket.IO reconnect; does not detach React root or remount the shell.
 *
 * Related:
 * - `utils/staleBundleReload.ts`
 * - `pages/Desktop/hooks/useDesktopSoftRecoveryListener.ts`
 */

import { Services } from '@/services';
import { getUserInfo } from '@/services/keycloak';
import { clearReloadCircuitWhenHealthy } from '@/services/maintenance/reloadCircuitBreaker';
import {
	fetchMaintenanceStatus,
	publishMaintenanceStatus,
} from '@/services/maintenance/maintenanceState';

async function reconnectSocketIfNeeded(): Promise<void> {
	const socket = Services.socket;
	if (socket.isConnected()) {
		return;
	}
	const user = getUserInfo();
	await socket.connect(
		user?.id
			? {
					user_id: String(user.id),
					user_name: user.username ?? user.email ?? undefined,
				}
			: undefined
	);
}

/** Soft recovery for non-desktop routes when bundle is already current. */
export async function performInPlaceMaintenanceRecovery(): Promise<boolean> {
	const ready = await clearReloadCircuitWhenHealthy();
	if (!ready) {
		return false;
	}

	try {
		const status = await fetchMaintenanceStatus();
		publishMaintenanceStatus(status);
	} catch {
		// Health ok but maintenance poll failed — still try socket reconnect.
	}

	try {
		await reconnectSocketIfNeeded();
	} catch {
		// Socket reconnect is best-effort.
	}

	return true;
}
