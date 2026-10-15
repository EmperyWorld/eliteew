/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared Tailwind class strings for unified admin form controls (focus, borders).
 *
 * Related:
 * - `pages/Admin/shell/eliteewAdminShell.css`
 * - `pages/Desktop/constants/index.ts` (DESKTOP_INTERACTIVE)
 */

import { DESKTOP_INTERACTIVE } from '@/pages/Desktop/constants';

/** Text / textarea inside `.eliteew-admin-shell`. */
export const ADMIN_SHELL_INPUT =
	'w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/45 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950';

export const ADMIN_SHELL_INPUT_MONO = `${ADMIN_SHELL_INPUT} font-mono`;

/** Command palette / chromeless search row (transparent bg). */
export const ADMIN_SHELL_CMD_INPUT = `flex-1 bg-transparent py-1 text-sm text-white outline-none placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-violet-400/45 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 rounded-sm ${DESKTOP_INTERACTIVE.focusRing}`;

export const ADMIN_SHELL_BTN_SECONDARY = `inline-flex items-center justify-center gap-1 rounded-lg border border-white/15 px-4 py-2 text-sm text-white/90 hover:bg-white/5 disabled:opacity-50 ${DESKTOP_INTERACTIVE.focusRing}`;

export const ADMIN_SHELL_BTN_PRIMARY = `inline-flex items-center justify-center gap-1 rounded-lg bg-violet-600/90 px-4 py-2 text-sm text-white hover:bg-violet-600 disabled:opacity-50 ${DESKTOP_INTERACTIVE.focusRing}`;

export const ADMIN_SHELL_BTN_SUCCESS = `inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-900/50 disabled:opacity-50 ${DESKTOP_INTERACTIVE.focusRing}`;

export const ADMIN_SHELL_BTN_ACCENT = `inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-600/90 px-4 py-2 text-sm text-white hover:bg-indigo-600 disabled:opacity-50 ${DESKTOP_INTERACTIVE.focusRing}`;

export const ADMIN_SHELL_BTN_WARN = `inline-flex items-center justify-center gap-1 rounded-lg bg-amber-600/90 px-4 py-2 text-sm text-white hover:bg-amber-600 disabled:opacity-50 ${DESKTOP_INTERACTIVE.focusRing}`;
