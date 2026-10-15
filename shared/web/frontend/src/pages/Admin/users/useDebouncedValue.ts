/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Debounce hook for admin Users search and URL sync.
 */

import * as React from 'react';

export function useDebouncedValue<T>(value: T, delayMs: number): T {
	const [debounced, setDebounced] = React.useState(value);
	React.useEffect(() => {
		const id = window.setTimeout(() => setDebounced(value), delayMs);
		return () => window.clearTimeout(id);
	}, [value, delayMs]);
	return debounced;
}
