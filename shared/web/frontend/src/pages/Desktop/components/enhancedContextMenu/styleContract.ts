/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shell class contracts for EnhancedContextMenu surfaces and flyouts.
 *
 * Invariants:
 * - Flyouts render outside inner scroll (overflow-y-auto clips fixed flyout).
 *
 * Related:
 * - EnhancedContextMenu.tsx (P30 atomization)
 */

import { cn } from '@/utils/cn';

/** Внешняя оболочка: акцент, без overflow-hidden — выпады рендерятся соседним слоем ниже скролла. */
export const ENHANCED_CTX_MENU_OUTER_SHELL_CLASS = cn(
	'relative border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.45)] ring-1 ring-(--desktop-border-menu) text-(--desktop-text-primary)'
);

/** Скролл только здесь — подменю не внутри, иначе absolute/fixed flyout обрезается overflow-y-auto. */
export const ENHANCED_CTX_MENU_INNER_SCROLL_CLASS = cn(
	'max-h-[min(85vh,calc(100dvh-1rem))] overflow-y-auto overscroll-y-contain'
);

export const ENHANCED_CTX_MENU_FLYOUT_SURFACE_CLASS = cn(
	'max-h-[min(70vh,calc(100dvh-24px))] overflow-x-hidden overflow-y-auto overscroll-y-contain py-1',
	'border-l-[3px] border-l-[rgb(var(--desktop-accent-rgb)/0.45)] ring-1 ring-(--desktop-border-menu)'
);
