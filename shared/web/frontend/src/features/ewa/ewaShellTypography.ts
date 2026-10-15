/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin typography bridge for EWA companion surfaces — re-exports desktop tokens
 * with semantic aliases so companion UI stays aligned with shell hierarchy.
 *
 * Invariants:
 * - No duplicate px ladders; all sizes resolve to DESKTOP_TYPOGRAPHY.
 * - Companion-specific names are aliases only, not new font scales.
 *
 * Related:
 * - src/pages/Desktop/constants/index.ts (DESKTOP_TYPOGRAPHY)
 * - documentation/product/UX-UI-COPY-GLOSSARY-2026-05.md
 */

import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

export { DESKTOP_TYPOGRAPHY };

/** Semantic typography map for companion chat, output surface, and operations cards. */
export const EWA_COMPANION_TYPOGRAPHY = {
	/** Wizard / mode hero line (~15px) */
	hero: cn(
		DESKTOP_TYPOGRAPHY.shellCopy15,
		'font-semibold leading-tight text-(--desktop-text-primary)'
	),
	/** Presence / progress primary label (~13px) */
	label: cn(
		DESKTOP_TYPOGRAPHY.shellCopy13,
		'font-semibold text-(--desktop-text-primary)'
	),
	/** Dense body in output surface (~13px, inherits semantic color from parent) */
	bodyDense: DESKTOP_TYPOGRAPHY.shellCopy13,
	/** Compact body (~12px, color from parent) */
	bodyCompact: 'text-xs antialiased',
	/** Secondary meta line (~11px) */
	meta: DESKTOP_TYPOGRAPHY.captionInherit,
	/** Micro copy / badge (~10px) */
	micro: DESKTOP_TYPOGRAPHY.shellMeta10,
	/** Uppercase overline chip (~10px) */
	overline: DESKTOP_TYPOGRAPHY.labelOverline,
	/** Smallest badge / count (~9px) */
	badge: DESKTOP_TYPOGRAPHY.micro,
	/** Operations card title (~11px medium) */
	cardTitle: cn(DESKTOP_TYPOGRAPHY.captionInherit, 'font-medium'),
	/** Standard body (~14px sm) */
	body: DESKTOP_TYPOGRAPHY.body,
	/** Muted hint at sm size */
	bodyMuted: DESKTOP_TYPOGRAPHY.bodyMuted,
	/** Gateway idle title — alias of hero */
	gatewayTitle: cn(
		DESKTOP_TYPOGRAPHY.shellCopy15,
		'font-semibold leading-tight text-(--desktop-text-primary)'
	),
	/** Gateway capability card title — alias of label */
	gatewayCardTitle: cn(
		DESKTOP_TYPOGRAPHY.shellCopy13,
		'font-semibold text-(--desktop-text-primary)'
	),
} as const;
