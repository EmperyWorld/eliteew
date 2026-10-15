/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop shell chrome class builders for EWRP generator form controls.
 *
 * Related:
 * - `useEwrpGeneratorCompose.ts`, `DesktopAppChrome`
 */

import { cn } from '@/utils/cn';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';

export function buildEwrpShellFieldClass(shellInset: string): string {
	return cn(
		shellInset,
		'w-full rounded-(--desktop-radius-lg) px-4 py-3 text-sm text-(--desktop-text-primary) placeholder:text-(--desktop-text-dim)',
		'motion-safe:transition-[border-color,box-shadow,background-color] motion-safe:duration-150',
		DESKTOP_CHROME_FOCUS_VISIBLE
	);
}

export function buildEwrpShellSelectClass(shellField: string): string {
	return cn(
		shellField,
		'cursor-pointer appearance-none',
		'motion-safe:enabled:hover:border-[rgb(var(--desktop-accent-rgb)/0.22)]',
		'focus-visible:border-[rgb(var(--desktop-accent-rgb)/0.35)] focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.22)]',
		'[&>option]:bg-[var(--desktop-surface-panel-strong)] [&>option]:text-[var(--desktop-text-primary)]'
	);
}

export function buildEwrpPrimaryBtnClass(): string {
	return cn(
		'inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white motion-safe:transition-[transform,filter,box-shadow] motion-safe:duration-200 disabled:cursor-not-allowed disabled:opacity-50',
		'bg-[rgb(var(--desktop-accent-rgb))] shadow-[0_6px_28px_-6px_rgb(var(--desktop-accent-rgb)/0.55),0_2px_8px_-2px_rgba(0,0,0,0.4)]',
		'hover:brightness-110 active:brightness-95 active:scale-[0.99]',
		'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-inset'
	);
}

export function buildEwrpSecondaryBtnClass(shellInset: string): string {
	return cn(
		'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-(--desktop-text-secondary) motion-safe:transition-[transform,background-color,border-color] motion-safe:duration-200 disabled:opacity-50',
		'motion-safe:active:scale-[0.98]',
		'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.4)] focus-visible:ring-inset',
		shellInset
	);
}
