/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Bump counter when desktop work area resizes (layout reflow for free widget slots).
 *
 * Invariants:
 * - Observes #desktop-main and window resize only.
 *
 * Related:
 * - DesktopWidgetsPanel.tsx
 */

import { useEffect, useState } from 'react';

export function useWidgetWorkAreaVersion(): number {
	const [v, setV] = useState(0);
	useEffect(() => {
		const bump = () => setV((n) => n + 1);
		const main = document.getElementById('desktop-main');
		const ro =
			typeof ResizeObserver !== 'undefined' ? new ResizeObserver(bump) : null;
		if (main && ro) ro.observe(main);
		window.addEventListener('resize', bump);
		return () => {
			ro?.disconnect();
			window.removeEventListener('resize', bump);
		};
	}, []);
	return v;
}
