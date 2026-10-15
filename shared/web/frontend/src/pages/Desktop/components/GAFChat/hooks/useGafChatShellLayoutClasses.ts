/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat desktop shell layout class strings derived from DesktopShellFrame.
 *
 * Invariants:
 * - Class tokens follow desktopVisualSystem helpers; no product-specific z-index here.
 *
 * Related:
 * - GAFChatApp.tsx
 * - utils/desktopVisualSystem.ts
 */
import { cn } from '@/utils/cn';
import { useMemo } from 'react';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import type { DesktopWindowStyle } from '@/types/profile';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '../../DesktopAppChrome';
import {
	getDesktopShellContentPanelClassName,
	getDesktopShellFooterStripClassName,
	getDesktopShellHeaderStripClassName,
	getDesktopShellNavRailClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '../../../utils/desktopVisualSystem';

export function useGafChatShellLayoutClasses(shellFrame: DesktopWindowStyle) {
	const shellAppToolbarClass = useMemo(
		() =>
			cn(
				getDesktopShellHeaderStripClassName(shellFrame),
				'grid min-w-0 grid-cols-1 gap-x-3 gap-y-2 px-3 py-2',
				'sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-y-0'
			),
		[shellFrame]
	);
	const shellNavAsideClass = useMemo(
		() =>
			cn(
				'flex min-h-0 min-w-0 shrink-0 flex-col border-r border-(--desktop-border-subtle)',
				'bg-[color-mix(in_srgb,var(--desktop-surface-panel)_58%,transparent)]',
				'shadow-[inset_-1px_0_0_rgba(255,255,255,0.045)]',
				getDesktopShellNavRailClassName(shellFrame)
			),
		[shellFrame]
	);
	const shellSidebarSearchRowClass = useMemo(
		() =>
			cn(
				'flex min-w-0 items-center gap-1.5 border-b border-(--desktop-border-subtle)/55 p-1.5 pb-2',
				getDesktopShellHeaderStripClassName(shellFrame)
			),
		[shellFrame]
	);
	const shellSidebarSearchInputClass = useMemo(
		() =>
			cn(
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
				'rounded-xl'
			),
		[shellFrame]
	);
	const shellMainColumnClass = useMemo(
		() =>
			cn(
				'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
				getDesktopShellContentPanelClassName(shellFrame),
				'rounded-l-none border-l-0'
			),
		[shellFrame]
	);
	const shellComposerFormClass = useMemo(
		() =>
			cn(
				'flex min-w-0 shrink-0 touch-manipulation flex-wrap items-end gap-2 p-2.5',
				getDesktopShellFooterStripClassName(shellFrame)
			),
		[shellFrame]
	);
	const shellComposerTextareaClass = useMemo(
		() =>
			cn(
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
				DESKTOP_TYPOGRAPHY.body,
				'w-full min-w-0 max-h-32 resize-none rounded-(--desktop-radius-lg) px-4 py-2.5 leading-relaxed text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim) outline-none transition-[border-color,background-color] duration-200 motion-reduce:transition-none',
				DESKTOP_CHROME_FOCUS_VISIBLE
			),
		[shellFrame]
	);
	const shellComposerHintRowClass = useMemo(
		() =>
			cn(
				'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-1.5 text-(--desktop-text-dim)',
				DESKTOP_TYPOGRAPHY.captionInherit,
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame)
			),
		[shellFrame]
	);

	return {
		shellAppToolbarClass,
		shellNavAsideClass,
		shellSidebarSearchRowClass,
		shellSidebarSearchInputClass,
		shellMainColumnClass,
		shellComposerFormClass,
		shellComposerTextareaClass,
		shellComposerHintRowClass,
	};
}
