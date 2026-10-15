/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Memoized Desktop AI Chat shell CSS class strings from desktop visual system tokens.
 *
 * Invariants:
 * - shellMessagesPanelClass stays glass-light (no double glass with bubbles).
 *
 * Related:
 * - DesktopAiChatApp.tsx, pages/Desktop/utils/desktopVisualSystem.ts
 */
import * as React from 'react';
import { useDesktopShellFrame } from '../../../pages/Desktop/context/DesktopShellFrameContext';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '../../../pages/Desktop/components/DesktopAppChrome';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '../../../pages/Desktop/constants';
import {
	getDesktopShellNavRailClassName,
	getDesktopShellToolbarClusterClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '../../../pages/Desktop/utils/desktopVisualSystem';
import { cn } from '@/utils/cn';

export type UseDesktopAiChatShellStylesParams = {
	shellFrame: ReturnType<typeof useDesktopShellFrame>;
	embeddedModalZ: { backdrop: number; content: number };
};

export function useDesktopAiChatShellStyles({
	shellFrame,
	embeddedModalZ,
}: UseDesktopAiChatShellStylesParams) {
	const soloSlotStackedModalZ = React.useMemo(
		() => ({
			backdrop: embeddedModalZ.content + 1,
			content: embeddedModalZ.content + 2,
		}),
		[embeddedModalZ]
	);

	const shellNavAsideClass = React.useMemo(
		() => getDesktopShellNavRailClassName(shellFrame),
		[shellFrame]
	);

	const shellMessagesPanelClass = React.useMemo(
		() =>
			cn(
				'flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-3',
				'rounded-(--desktop-radius-lg) border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)]',
				'bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.12)_100%,transparent)]'
			),
		[]
	);

	const shellComposerDockClass = React.useMemo(
		() =>
			cn(
				getDesktopShellToolbarClusterClassName(shellFrame),
				'px-2 py-1.5 rounded-xl'
			),
		[shellFrame]
	);

	const shellComposerTextareaClass = React.useMemo(
		() =>
			cn(
				'w-full min-w-0 flex-1 min-h-[48px] max-h-36 resize-y rounded-lg border-0 bg-transparent px-2.5 py-2 text-sm outline-none',
				'placeholder:text-(--desktop-text-muted)',
				DESKTOP_CHROME_FOCUS_VISIBLE,
				DESKTOP_TYPOGRAPHY.body
			),
		[]
	);

	const shellComposerIconBtnClass = React.useMemo(
		() =>
			cn(
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
				'inline-flex min-h-11 min-w-11 items-center justify-center p-3 rounded-xl',
				DESKTOP_INTERACTIVE.btnRounded
			),
		[shellFrame]
	);

	const shellHeaderBarClusterClass = React.useMemo(
		() =>
			cn(
				getDesktopShellToolbarClusterClassName(shellFrame),
				'flex min-w-0 flex-wrap items-center gap-1.5 pr-10 sm:pr-12 px-2 py-1 rounded-xl'
			),
		[shellFrame]
	);

	const shellChatSearchInputClass = React.useMemo(
		() =>
			cn(
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
				'w-full rounded-lg py-1.5 pl-7 pr-2 text-xs text-[var(--desktop-text-secondary)] antialiased',
				DESKTOP_CHROME_FOCUS_VISIBLE
			),
		[shellFrame]
	);

	const shellNewChatBtnClass = React.useMemo(
		() =>
			cn(
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
				'flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm',
				DESKTOP_INTERACTIVE.btnRounded
			),
		[shellFrame]
	);

	const shellComposerStopBtnClass = React.useMemo(
		() =>
			cn(
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
				'inline-flex min-h-11 items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs',
				DESKTOP_INTERACTIVE.btnRounded
			),
		[shellFrame]
	);

	const shellHeaderCollapseBtnClass = React.useMemo(
		() =>
			cn(
				getDesktopShellToolbarClusterInsetControlClassName(shellFrame),
				'shrink-0 p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-offset-1 focus-visible:ring-offset-transparent',
				DESKTOP_INTERACTIVE.btnRounded
			),
		[shellFrame]
	);

	return {
		soloSlotStackedModalZ,
		shellNavAsideClass,
		shellMessagesPanelClass,
		shellComposerDockClass,
		shellComposerTextareaClass,
		shellComposerIconBtnClass,
		shellHeaderBarClusterClass,
		shellChatSearchInputClass,
		shellNewChatBtnClass,
		shellComposerStopBtnClass,
		shellHeaderCollapseBtnClass,
	};
}
