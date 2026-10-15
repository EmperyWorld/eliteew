/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mobile embedded field-mode quick actions: contact log, showings, listing photo.
 *
 * Related:
 * - FieldModeQuickPanel.tsx
 */

export type ProfessionalWorldsFieldModeActionId =
	| 'contact'
	| 'showing'
	| 'listingPhoto';

export const PROFESSIONAL_WORLDS_FIELD_MODE_ACTIONS: Array<{
	id: ProfessionalWorldsFieldModeActionId;
	labelKey: string;
}> = [
	{ id: 'contact', labelKey: 'fieldMode.actions.contact' },
	{ id: 'showing', labelKey: 'fieldMode.actions.showing' },
	{ id: 'listingPhoto', labelKey: 'fieldMode.actions.listingPhoto' },
];

export function isProfessionalWorldsFieldMode(
	embeddedMobileLayout: boolean
): boolean {
	return embeddedMobileLayout;
}

export function resolveFieldModeModuleKey(
	actionId: ProfessionalWorldsFieldModeActionId
): string | null {
	if (actionId === 'contact') return 'realtor_communications';
	if (actionId === 'showing') return 'realtor_showings';
	return null;
}
