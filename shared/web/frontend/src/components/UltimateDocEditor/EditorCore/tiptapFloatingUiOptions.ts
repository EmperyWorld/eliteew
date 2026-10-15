/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared Floating UI options for TipTap BubbleMenu and FloatingMenu in desktop shell.
 *
 * Invariants:
 * - strategy: fixed — anchor stays aligned when parent uses transform: scale(...).
 *
 * Related:
 * - TiptapBubbleMenu.tsx, TiptapFloatingMenu.tsx
 */

export interface TiptapFloatingUiOptions {
	strategy: 'fixed';
	flip: true;
	shift: { padding: number };
}

export const TIPTAP_FLOATING_UI_OPTIONS: TiptapFloatingUiOptions = {
	strategy: 'fixed',
	flip: true,
	shift: { padding: 8 },
};
