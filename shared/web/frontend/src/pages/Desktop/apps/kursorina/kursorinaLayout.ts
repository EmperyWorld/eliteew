/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared layout shells for Kursorina Desktop — ultrawide-friendly content width
 * with a readable cap (not full 4K bleed).
 *
 * Related:
 * - KursorinaReportView / Findings / Goal / Composer
 * - documentation/product/desktop/KURSORINA.md
 */

import { cn } from '@/utils/cn';

/**
 * Main investigation column: fills wide Desktop windows up to ~88rem (1408px).
 * Replaces legacy `max-w-4xl` (56rem) that left empty gutters on ultrawide.
 */
export const KURSORINA_CONTENT_MAX = 'w-full max-w-[min(100%,88rem)]';

export const KURSORINA_CONTENT_SHELL = cn(
	'mx-auto flex',
	KURSORINA_CONTENT_MAX,
	'flex-col'
);

/** Horizontal/vertical padding for scroll panes. */
export const KURSORINA_CONTENT_PAD = 'p-4 sm:p-6 lg:px-8 xl:px-10 2xl:px-12';

/** Findings list: one column until wide, then two. */
export const KURSORINA_FINDINGS_GRID = 'grid grid-cols-1 gap-3 xl:grid-cols-2';
