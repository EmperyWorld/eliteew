/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared segment-button styling for Visual Studio hotspot popover option grids.
 *
 * Invariants:
 * - Uses desktop typography + chrome focus tokens.
 *
 * Related:
 * - `hotspotPopoverContent.tsx`
 */

import { cn } from '@/utils/cn';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '../../DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '../../../constants';

export function segmentButtonClass(active: boolean): string {
	return cn(
		'rounded-lg border px-2 py-1.5 text-left font-medium transition-colors outline-none',
		DESKTOP_TYPOGRAPHY.captionInherit,
		DESKTOP_CHROME_FOCUS_VISIBLE,
		active
			? 'border-[rgb(var(--desktop-accent-rgb))] bg-[rgb(var(--desktop-accent-rgb)/0.14)] text-(--desktop-text-primary)'
			: 'border-(--desktop-border-subtle) bg-(--desktop-surface-soft) text-(--desktop-text-secondary) hover:border-(--desktop-border-strong)'
	);
}
