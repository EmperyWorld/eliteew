/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact two-column field grid used by the media workbench brand kit form.
 *
 * Invariants:
 * - — (нет)
 *
 * Related:
 * - MediaWorkbenchBrandKitPanel.tsx
 */

import type { ReactElement, ReactNode } from 'react';

export function FieldGrid({
	children,
}: {
	readonly children: ReactNode;
}): ReactElement {
	return <div className="grid gap-2 sm:grid-cols-2">{children}</div>;
}
