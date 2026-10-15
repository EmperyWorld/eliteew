/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared dialog state types for companion quick preset label save/rename CRUD (Phase 5.4).
 *
 * Invariants:
 * - Save mode carries `promptText` from composer draft; rename mode carries server `presetId`.
 *
 * Related:
 * - src/features/ewa/CompanionQuickPresetLabelDialog.tsx
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 */

export type CompanionQuickPresetLabelDialogState =
	| {
			mode: 'save';
			value: string;
			promptText: string;
	  }
	| {
			mode: 'rename';
			value: string;
			presetId: string;
			previousLabel: string;
	  };
