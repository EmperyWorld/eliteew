/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Legacy absolute-position slot for in-app tour launch buttons (upper-right of a positioned parent).
 *
 * Invariants:
 * - Desktop app windows use the shared title-bar «Экскурсия» control (`WindowTitleBar` + `useDesktopGuideTourOpener`) instead.
 *
 * Related:
 * - GuideTourLaunchButton.tsx, WindowTitleBar.tsx
 */

import { cn } from '@/utils/cn';
import type * as React from 'react';

/** @deprecated Prefer title-bar launch via `useDesktopGuideTourOpener`. */
export function GuideTourLaunchSlot(props: {
	children: React.ReactNode;
	className?: string;
}): React.ReactElement {
	const { children, className } = props;
	return (
		<div
			className={cn(
				'pointer-events-auto absolute right-2 top-2 z-20 sm:right-3 sm:top-2.5',
				className
			)}
		>
			{children}
		</div>
	);
}
