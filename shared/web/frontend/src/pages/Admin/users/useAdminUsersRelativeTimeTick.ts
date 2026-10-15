/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Re-render hook for relative «last seen» labels in catalog channel cells.
 */

import * as React from 'react';

const DEFAULT_MS = 30_000;

export function useAdminUsersRelativeTimeTick(
	intervalMs: number = DEFAULT_MS
): number {
	const [tick, setTick] = React.useState(0);

	React.useEffect(() => {
		const id = window.setInterval(() => setTick((n) => n + 1), intervalMs);
		return () => window.clearInterval(id);
	}, [intervalMs]);

	return tick;
}
