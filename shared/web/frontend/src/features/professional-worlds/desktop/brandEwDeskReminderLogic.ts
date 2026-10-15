/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Decide when Brand workspace should remind the specialist to hand off generated copy to EWDesk.
 *
 * Related:
 * - BrandWorkspacePanel.tsx
 */

export function brandLaneHasGeneratedCopy(input: {
	text: string;
	status: string;
}): boolean {
	return Boolean(input.text.trim()) || Boolean(input.status.trim());
}

export function brandEwDeskIntegrationEnabled(
	integrations: Array<{ integration_key: string; is_enabled: boolean }>
): boolean {
	return integrations.some(
		(item) =>
			item.is_enabled &&
			item.integration_key.trim().toLowerCase().replace(/_/g, '-') === 'ewdesk'
	);
}

export function shouldShowBrandEwDeskReminder(input: {
	brandStreamText: string;
	brandStreamStatus: string;
	integrations: Array<{ integration_key: string; is_enabled: boolean }>;
}): boolean {
	return (
		brandLaneHasGeneratedCopy({
			text: input.brandStreamText,
			status: input.brandStreamStatus,
		}) && brandEwDeskIntegrationEnabled(input.integrations)
	);
}
