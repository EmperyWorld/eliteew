/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Debounce a value for streaming markdown render cadence in Assistant chat.
 *
 * Invariants:
 * - Clears pending timeout on value or delay change.
 *
 * Related:
 * - pages/Desktop/components/assistant/useAssistantMessageStream.ts
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
