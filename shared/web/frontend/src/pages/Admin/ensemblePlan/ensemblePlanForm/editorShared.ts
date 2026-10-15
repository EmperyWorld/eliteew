/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared class tokens and helpers for the ensemble PlanTemplate form editor sections.
 *
 * Invariants:
 * - Admin shell input tokens come from `adminFormClasses` (no local hardcode of base input chrome).
 *
 * Related:
 * - `../DesktopEnsemblePlanFormEditor.tsx`
 * - `../../shell/adminFormClasses.ts`
 */

import { ADMIN_SHELL_INPUT } from '../../shell/adminFormClasses';

export type EnsemblePlanEditorTab = 'form' | 'json';

export const INPUT = ADMIN_SHELL_INPUT;
export const BTN_ICON =
	'inline-flex items-center justify-center rounded border border-white/15 p-1.5 text-white/70 hover:bg-white/10';
export const BTN_SECONDARY =
	'inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-xs text-white/85 hover:bg-white/10';
export const CARD =
	'scroll-mt-4 rounded-xl border border-white/10 bg-slate-950/50 p-4 shadow-sm shadow-black/20';
export const SECTION_NAV_BTN =
	'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors';
export const HINT_BOX =
	'rounded-lg border border-sky-500/25 bg-sky-950/20 px-3 py-2.5 text-xs text-sky-100/90 leading-relaxed';

export function scrollToSection(id: string): void {
	document
		.getElementById(id)
		?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
