/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Auto-clear transient flash state (success ack, highlight ids) after a timeout.
 *
 * Invariants:
 * - Falsy flash values skip the timer.
 *
 * Related:
 * - pages/Desktop/components/AssistantApp.tsx
 */
import * as React from 'react';

export function useAssistantFlashTimeout<T>(
	flash: T | null | false | undefined,
	clear: () => void,
	ms = 2000
): void {
	React.useEffect(() => {
		if (!flash) return;
		const id = window.setTimeout(clear, ms);
		return () => window.clearTimeout(id);
	}, [flash, clear, ms]);
}
