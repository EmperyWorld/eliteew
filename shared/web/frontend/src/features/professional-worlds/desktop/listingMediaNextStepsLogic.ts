/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Suggest listing photo → brand → handoff next steps after the media workbench on Objects.
 *
 * Invariants:
 * - Pure helper; callers wire navigation handlers.
 *
 * Related:
 * - ListingMediaNextStepsPanel.tsx
 * - ProfessionalMediaWorkbench.tsx
 */

export type ListingMediaNextStepId =
	| 'openBrandStarters'
	| 'openResultsHandoff'
	| 'openListingWorkspace';

export function resolveListingMediaNextSteps(input: {
	hasSelectedProperty: boolean;
	mediaStudioEnabled: boolean;
	propertyArtifactCount: number;
	siteStudioHandoffEnabled: boolean;
}): ListingMediaNextStepId[] {
	if (!input.hasSelectedProperty || !input.mediaStudioEnabled) return [];
	const steps: ListingMediaNextStepId[] = ['openListingWorkspace'];
	steps.push('openBrandStarters');
	if (input.propertyArtifactCount > 0 && input.siteStudioHandoffEnabled) {
		steps.push('openResultsHandoff');
	}
	return steps;
}

export function listingMediaNextStepI18nKey(
	stepId: ListingMediaNextStepId
): string {
	return `properties.mediaNextSteps.${stepId}`;
}
