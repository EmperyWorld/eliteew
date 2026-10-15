/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * In-place desktop recovery after maintenance/outage — refresh data, socket, maintenance store without hard reload.
 *
 * Invariants:
 * - Returns false until `/api/health` and maintenance API confirm recovery (`clearReloadCircuitWhenHealthy`).
 * - Publishes fresh maintenance status so client-side unplanned windows clear when server is idle.
 *
 * Related:
 * - `pages/Desktop/hooks/useDesktopSoftRecoveryListener.ts`
 * - `utils/staleBundleReload.ts`
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

/** Soft recovery for `#desktop` — no tab reload. */
export async function performDesktopSoftRecovery(
	refreshStorage: () => void | Promise<void>
): Promise<boolean> {
	const ready = await clearReloadCircuitWhenHealthy();
	if (!ready) {
		return false;
	}

	try {
		const status = await fetchMaintenanceStatus();
		publishMaintenanceStatus(status);
	} catch {
		// Health ok but maintenance poll failed — still try storage/socket refresh.
	}

	try {
		await reconnectSocketIfNeeded();
	} catch {
		// Socket reconnect is best-effort; storage refresh still valuable.
	}

	await refreshStorage();
	return true;
}
