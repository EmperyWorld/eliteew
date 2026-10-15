/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Layout and surface tokens for Content Manager Files tab chrome (toolbar, wayfinding, search).
 *
 * Invariants:
 * - Use `--desktop-*` tokens only; no one-off accent glow or purple AI chrome.
 *
 * Related:
 * - `ContentManagerFilesChrome.tsx`
 * - `documentation/product/desktop/DESKTOP_DESIGN_SYSTEM.md`
 */
import { cn } from '@/utils/cn';
import { DESKTOP_APP_STYLE_CONTRACT } from '../Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../Desktop/constants';

/** Shared class bundles for Files tab chrome surfaces. */
export const CONTENT_MANAGER_FILES_CHROME = {
	/** Horizontal search strip above the file grid (non-split layout). */
	searchStrip: cn(
		'flex shrink-0 flex-wrap items-center gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle)/70',
		DESKTOP_APP_STYLE_CONTRACT.softCard,
		'bg-(--desktop-surface-soft)/50 p-2 sm:gap-2.5'
	),
	/** Panel toolbar card above grid/list. */
	panelToolbar: cn(
		'flex min-w-0 flex-col gap-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle)/60',
		DESKTOP_APP_STYLE_CONTRACT.softCard,
		'p-2'
	),
	/** Segmented control cluster (browse mode, view mode, search mode). */
	segmentCluster:
		'inline-flex max-w-full flex-wrap gap-0.5 rounded-lg border border-(--desktop-border-subtle)/75 bg-(--desktop-surface-soft)/35 p-0.5',
	segmentButton: (active: boolean) =>
		cn(
			'inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors motion-reduce:transition-none',
			active
				? 'bg-(--desktop-surface-panel) text-(--desktop-text-primary) shadow-[inset_0_0_0_1px_var(--desktop-border-subtle)]'
				: 'text-(--desktop-text-secondary) hover:bg-(--desktop-surface-panel)/80 hover:text-(--desktop-text-primary)'
		),
	/** Breadcrumb / context strip — lighter than a full card. */
	wayfindingStrip: cn(
		DESKTOP_TYPOGRAPHY.meta,
		'mb-2 flex min-w-0 max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 px-0.5 py-1 text-(--desktop-text-secondary)'
	),
	wayfindingCrumb: 'min-w-0 shrink truncate',
	wayfindingCurrent: 'font-medium text-(--desktop-text-primary)',
	wayfindingSeparator: 'text-(--desktop-text-dim) select-none',
	/** Collapsible secondary tools row inside panel toolbar. */
	toolsRow:
		'flex min-w-0 flex-wrap items-center gap-1.5 border-t border-(--desktop-border-subtle)/50 pt-2',
	toolsToggle:
		'h-8 gap-1.5 px-2.5 text-(--desktop-text-secondary) hover:text-(--desktop-text-primary)',
} as const;
