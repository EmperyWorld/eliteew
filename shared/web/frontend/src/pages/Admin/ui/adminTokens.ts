/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * TypeScript class maps for Admin New World UI (tokens.css companion).
 *
 * Invariants:
 * - Uses --admin-ui-* / --desktop-* CSS variables only.
 * - Must not import Old World admin chrome (adminUiShared, adminChrome, DESKTOP_INTERACTIVE).
 *
 * Related:
 * - documentation/platform/UNIFIED-ADMIN-DESIGN-SYSTEM-AND-GAP-ROADMAP.md
 * - pages/Admin/ui/tokens.css
 */

export const ADMIN_UI_ROOT_CLASS = 'eliteew-admin-ui';

export const adminUiFocusRing =
	'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-ui-focus-ring)] focus-visible:ring-inset';

export const adminUiFieldClass = [
	'w-full rounded-[var(--admin-ui-radius-sm)] border border-[var(--admin-ui-border)]',
	'bg-[var(--admin-ui-surface)] px-3 py-2 text-[length:var(--admin-ui-text-sm)]',
	'text-[var(--admin-ui-fg)] placeholder:text-[var(--admin-ui-fg-dim)]',
	'disabled:opacity-50',
	adminUiFocusRing,
].join(' ');

export const adminUiButtonBase = [
	'inline-flex items-center justify-center gap-2 rounded-[var(--admin-ui-radius-sm)]',
	'px-3 py-2 text-[length:var(--admin-ui-text-sm)] font-medium transition-colors',
	'motion-reduce:transition-none',
	'disabled:pointer-events-none disabled:opacity-50',
	adminUiFocusRing,
].join(' ');

export const adminUiButtonVariant = {
	primary: [
		adminUiButtonBase,
		'bg-[var(--admin-ui-accent)] text-white hover:brightness-110 active:brightness-95',
	].join(' '),
	secondary: [
		adminUiButtonBase,
		'border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)]',
		'text-[var(--admin-ui-fg)] hover:bg-[var(--admin-ui-accent-soft)]',
	].join(' '),
	danger: [
		adminUiButtonBase,
		'bg-[var(--admin-ui-status-danger-bg)] text-[var(--admin-ui-status-danger)]',
		'border border-[var(--admin-ui-status-danger)]/40 hover:brightness-110',
	].join(' '),
	ghost: [
		adminUiButtonBase,
		'bg-transparent text-[var(--admin-ui-fg-muted)] hover:bg-[var(--admin-ui-accent-soft)]',
		'hover:text-[var(--admin-ui-fg)]',
	].join(' '),
} as const;

export type AdminUiButtonVariant = keyof typeof adminUiButtonVariant;

export const adminUiBannerTone = {
	success: {
		border: 'border-[var(--admin-ui-status-success)]/35',
		bg: 'bg-[var(--admin-ui-status-success-bg)]',
		fg: 'text-[var(--admin-ui-status-success)]',
	},
	warning: {
		border: 'border-[var(--admin-ui-status-warning)]/35',
		bg: 'bg-[var(--admin-ui-status-warning-bg)]',
		fg: 'text-[var(--admin-ui-status-warning)]',
	},
	danger: {
		border: 'border-[var(--admin-ui-status-danger)]/35',
		bg: 'bg-[var(--admin-ui-status-danger-bg)]',
		fg: 'text-[var(--admin-ui-status-danger)]',
	},
	info: {
		border: 'border-[var(--admin-ui-status-info)]/35',
		bg: 'bg-[var(--admin-ui-status-info-bg)]',
		fg: 'text-[var(--admin-ui-status-info)]',
	},
} as const;

export type AdminUiBannerTone = keyof typeof adminUiBannerTone;

export const adminUiTableWrapClass = [
	'overflow-x-auto rounded-[var(--admin-ui-radius)]',
	'border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface)]',
].join(' ');

export const adminUiModalBackdropClass = [
	'fixed inset-0 z-[var(--admin-ui-z-modal)] flex items-center justify-center p-4',
	'bg-[var(--admin-ui-backdrop)]',
].join(' ');

export const adminUiModalPanelClass = [
	'max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[var(--admin-ui-radius)]',
	'border border-[var(--admin-ui-border)] bg-[var(--admin-ui-surface-strong)] p-6',
	'text-[var(--admin-ui-fg)]',
].join(' ');
