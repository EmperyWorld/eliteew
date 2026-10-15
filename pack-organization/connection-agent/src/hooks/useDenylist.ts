/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Denylist refresh/status for O4 soft-revoke gate on shell.
 */

import { useCallback, useState } from 'react';
import {
	denylistRefresh,
	denylistStatus,
	type DenylistStatusView,
} from '../lib/tauri-bridge/commands';

export function useDenylist() {
	const [denylist, setDenylist] = useState<DenylistStatusView | null>(null);

	const refreshDenylist = useCallback(async () => {
		try {
			const refreshed = await denylistRefresh();
			setDenylist(refreshed);
			return refreshed;
		} catch {
			try {
				const cached = await denylistStatus();
				setDenylist(cached);
				return cached;
			} catch {
				return null;
			}
		}
	}, []);

	return { denylist, refreshDenylist };
}
