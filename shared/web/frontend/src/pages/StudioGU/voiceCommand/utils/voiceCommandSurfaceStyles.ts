/**
 * Pure class strings for Voice Command Center bubbles/badges — desktop tokens only (no zinc/slate).
 * Covered by unit tests for regression on token wiring.
 */

/**
 * Scrollport for HQ body (macros / commands / feed). Mic controls stay outside this region
 * so expanded accordions scroll instead of clipping under overflow-hidden ancestors.
 */
export const VCC_SCROLL_BODY_CLASSNAME =
	'flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-color:color-mix(in_srgb,var(--desktop-text-primary)_22%,transparent)_transparent] scrollbar-thin';

/** Feed inside the scroll body — keeps a readable min height without owning a nested scroll. */
export const VCC_FEED_IN_SCROLL_CLASSNAME =
	'min-h-[12rem] flex-1 space-y-3 rounded-(--desktop-radius-lg) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_38%,transparent)] px-3 py-3 ring-1 ring-inset ring-[rgb(var(--desktop-fg-primary-rgb)/0.05)] md:px-4 md:py-3.5';

/** Command result row (success / error) inside MessageBubble */
export function commandMessageBubbleClasses(
	status: 'success' | 'error'
): string {
	if (status === 'success') {
		return [
			'border border-(--desktop-border-subtle)',
			'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_88%,rgb(var(--desktop-accent-rgb))_12%)]',
			'text-(--desktop-text-primary)',
			'shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.05)]',
		].join(' ');
	}
	return [
		'border border-[color-mix(in_srgb,rgb(239_68_68)_38%,var(--desktop-border-subtle))]',
		'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_78%,rgb(239_68_68)_22%)]',
		'text-(--desktop-text-primary)',
		'shadow-[inset_0_1px_0_rgb(var(--desktop-fg-primary-rgb)/0.04)]',
	].join(' ');
}

export function statusBadgeShellClasses(active: boolean): string {
	if (active) {
		return [
			'border border-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_42%,var(--desktop-border-subtle))]',
			'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_88%,rgb(var(--desktop-accent-rgb))_12%)]',
			'text-(--desktop-text-secondary)',
		].join(' ');
	}
	return [
		'border border-[color-mix(in_srgb,rgb(239_68_68)_38%,var(--desktop-border-subtle))]',
		'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_82%,rgb(239_68_68)_18%)]',
		'text-[color-mix(in_srgb,rgb(254_202_202)_82%,var(--desktop-text-secondary))]',
	].join(' ');
}

export function statusBadgeDotClasses(active: boolean): string {
	return active
		? 'bg-[rgb(var(--desktop-accent-rgb))]'
		: 'bg-[color-mix(in_srgb,rgb(239_68_68)_88%,transparent)]';
}
