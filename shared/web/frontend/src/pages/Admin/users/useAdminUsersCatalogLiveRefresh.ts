/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Periodic directory refetch for live Socket.IO / presence columns (catalog tab, visible tab).
 *
 * Invariants:
 * - Skips tick when `document.visibilityState` is not `visible`.
 * - Disabled when operator enabled 30s auto-refresh (that interval already refetches).
 */

import * as React from 'react';

/** Presence-oriented refresh; full catalog refetch reuses directory query. */
export const ADMIN_USERS_LIVE_PRESENCE_MS = 20_000;

export function useAdminUsersCatalogLiveRefresh(
	refetch: () => Promise<unknown>,
	opts: { enabled: boolean; skipWhenAutoRefresh: boolean }
): void {
	const { enabled, skipWhenAutoRefresh } = opts;

	React.useEffect(() => {
		if (!enabled || skipWhenAutoRefresh) return;

		const tick = () => {
			if (document.visibilityState !== 'visible') return;
			void refetch();
		};

		tick();
		const intervalId = window.setInterval(tick, ADMIN_USERS_LIVE_PRESENCE_MS);
		const onVisibility = () => {
			if (document.visibilityState === 'visible') tick();
		};
		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			window.clearInterval(intervalId);
			document.removeEventListener('visibilitychange', onVisibility);
		};
	}, [enabled, skipWhenAutoRefresh, refetch]);
}
