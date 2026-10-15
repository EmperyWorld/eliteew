/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared IMC Research view helpers: form control class, markdown text stats,
 * and status badge styling.
 *
 * Invariants:
 * - statusBadgeClass keys stay aligned with IMC run status strings from API.
 *
 * Related:
 * - ImcResearchView.tsx
 * - useImcResearchController.ts
 */

/** Shared focus ring for IMC form controls (aligned with `TEXTAREA_CLASS`). */
export const IMC_CONTROL_CLASS =
	'rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) outline-none transition-colors focus:border-(--desktop-border-strong) focus:ring-1 focus:ring-(--mc-accent-30) disabled:cursor-not-allowed disabled:opacity-60';

/** Статистика текста результата ИМК для подписей в UI (длина строки, число строк с переносами). */
export function imcMarkdownTextStats(text: string): {
	chars: number;
	lines: number;
} {
	if (!text) return { chars: 0, lines: 0 };
	return {
		chars: text.length,
		lines: text.split(/\r\n|\r|\n/).length,
	};
}

export function statusBadgeClass(status: string): string {
	switch (status) {
		case 'completed':
			return 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30';
		case 'failed':
			return 'bg-red-500/15 text-red-200 ring-red-500/30';
		case 'cancelled':
			return 'bg-(--desktop-text-dim)/20 text-(--desktop-text-muted) ring-(--desktop-border-subtle)';
		case 'running':
		case 'pending':
			return 'bg-amber-500/15 text-amber-200 ring-amber-500/30';
		case 'partial':
			return 'bg-violet-500/15 text-violet-200 ring-violet-500/30';
		default:
			return 'bg-(--desktop-surface-soft) text-(--desktop-text-muted) ring-(--desktop-border-subtle)';
	}
}
