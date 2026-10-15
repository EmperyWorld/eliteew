/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop shell chrome class builders for AmkaView segmented controls and checkboxes.
 *
 * Invariants:
 * - Uses DesktopShellFrame context; no hardcoded theme colors outside tokens.
 *
 * Related:
 * - useAmkaViewCompose.ts, AmkaViewMainTabs.tsx
 */

import { useMemo } from 'react';

import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { cn } from '@/utils/cn';
import { useDesktopShellFrame } from '@/pages/Desktop/context/DesktopShellFrameContext';
import {
	getDesktopShellCheckboxControlClassName,
	getDesktopShellToolbarClusterClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '@/pages/Desktop/utils/desktopVisualSystem';

export function useAmkaViewShellStyles() {
	const shellFrame = useDesktopShellFrame();

	const formCheckboxClass = useMemo(
		() =>
			cn(
				getDesktopShellCheckboxControlClassName(shellFrame),
				'accent-[rgb(var(--desktop-accent-rgb))]',
				DESKTOP_CHROME_FOCUS_VISIBLE,
				'size-4 shrink-0'
			),
		[shellFrame]
	);

	const runModeClusterClass = useMemo(
		() =>
			cn(
				getDesktopShellToolbarClusterClassName(shellFrame),
				'inline-flex w-full flex-wrap gap-0.5 rounded-xl p-0.5 sm:w-auto'
			),
		[shellFrame]
	);

	const runModeTabClass = useMemo(
		() => (active: boolean) =>
			cn(
				'min-w-0 flex-1 px-3 py-2 text-left text-xs font-medium rounded-lg transition-[color,background-color,border-color] duration-150 outline-none sm:flex-none',
				DESKTOP_CHROME_FOCUS_VISIBLE,
				active
					? 'bg-[rgb(var(--desktop-accent-rgb)/0.25)] text-(--desktop-text-primary)'
					: cn(
							getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
							'text-(--desktop-text-secondary)'
						)
			),
		[shellFrame]
	);

	return { formCheckboxClass, runModeClusterClass, runModeTabClass };
}
