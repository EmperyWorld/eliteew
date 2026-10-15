/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layout and typography class tokens for Feedback Hub shell, list toolbar, and compose chrome.
 *
 * Invariants:
 * - Uses desktop CSS variables and DESKTOP_TYPOGRAPHY; shell-frame variants via hook caller.
 *
 * Related:
 * - FeedbackHubApp.tsx · useFeedbackHubLayoutClasses.ts · FEEDBACK-HUB.md
 */
import { cn } from '@/utils/cn';
import { DESKTOP_TYPOGRAPHY } from '../../constants';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '../DesktopAppChrome';
import {
	getDesktopShellHeaderStripClassName,
	getDesktopShellToolbarClusterClassName,
	getDesktopShellToolbarClusterInsetControlClassName,
} from '../../utils/desktopVisualSystem';
import type { DesktopWindowStyle } from '../../types';

export function buildFeedbackHubHeaderStripClass(
	shellFrame: DesktopWindowStyle
): string {
	return cn(
		'shrink-0 px-3 py-2.5 sm:px-5 lg:px-6',
		getDesktopShellHeaderStripClassName(shellFrame)
	);
}

export function buildFeedbackHubListToolbarClusterClass(
	shellFrame: DesktopWindowStyle
): string {
	return cn(
		'mb-4 flex flex-col gap-3 p-3 rounded-(--desktop-radius-lg)',
		getDesktopShellToolbarClusterClassName(shellFrame)
	);
}

export function buildFeedbackHubListSearchInputClass(
	shellFrame: DesktopWindowStyle
): string {
	return cn(
		'w-full py-2 pl-9 pr-3',
		DESKTOP_TYPOGRAPHY.body,
		'text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim)',
		DESKTOP_CHROME_FOCUS_VISIBLE,
		getDesktopShellToolbarClusterInsetControlClassName(shellFrame)
	);
}

export function buildFeedbackHubKindToggleClusterClass(
	shellFrame: DesktopWindowStyle
): string {
	return cn(
		'grid grid-cols-2 gap-2 rounded-(--desktop-radius) p-1',
		getDesktopShellToolbarClusterClassName(shellFrame)
	);
}

export function buildFeedbackHubSendActionBarClass(
	shellFrame: DesktopWindowStyle
): string {
	return cn(
		'mt-6 flex flex-wrap items-center justify-end gap-2 rounded-xl px-3 py-3 sm:px-4',
		getDesktopShellToolbarClusterClassName(shellFrame)
	);
}

export const FEEDBACK_HUB_TRUSTED_BADGE_CLASS = cn(
	'inline-flex shrink-0 items-center gap-1.5 rounded-(--desktop-radius-pill)',
	'border border-emerald-500/35 bg-emerald-500/12 px-2.5 py-1 font-semibold text-emerald-100',
	DESKTOP_TYPOGRAPHY.captionInherit
);

export const FEEDBACK_HUB_HEADER_ICON_WRAP_CLASS = cn(
	'flex h-10 w-10 shrink-0 items-center justify-center rounded-(--desktop-radius-lg)',
	'border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)',
	'shadow-(--desktop-shadow-soft)'
);
