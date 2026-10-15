/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Post–media-workbench CTAs on Objects: brand starters, Results handoff, stay on listing workspace.
 *
 * Related:
 * - listingMediaNextStepsLogic.ts
 * - RealtorObjectsWorkspacePanel.tsx
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

import { resolveIntegrationKeyForDraftKind } from '../artifactQuickHandoffLogic';
import {
	listingMediaNextStepI18nKey,
	resolveListingMediaNextSteps,
} from '../listingMediaNextStepsLogic';
import { ProfessionalWorldsWorkspacePanel } from '../layout';
import type { ProfessionalRuntimeIntegration } from '../types';

export function ListingMediaNextStepsPanel({
	hasSelectedProperty,
	mediaStudioEnabled,
	propertyArtifactCount,
	integrations,
	onOpenBrandStarters,
	onOpenResultsHandoff,
	onOpenListingWorkspace,
}: {
	hasSelectedProperty: boolean;
	mediaStudioEnabled: boolean;
	propertyArtifactCount: number;
	integrations: readonly ProfessionalRuntimeIntegration[];
	onOpenBrandStarters: () => void;
	onOpenResultsHandoff: () => void;
	onOpenListingWorkspace: () => void;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const siteStudioHandoffEnabled = useMemo(
		() =>
			Boolean(
				resolveIntegrationKeyForDraftKind('site-studio', [...integrations])
			),
		[integrations]
	);
	const steps = useMemo(
		() =>
			resolveListingMediaNextSteps({
				hasSelectedProperty,
				mediaStudioEnabled,
				propertyArtifactCount,
				siteStudioHandoffEnabled,
			}),
		[
			hasSelectedProperty,
			mediaStudioEnabled,
			propertyArtifactCount,
			siteStudioHandoffEnabled,
		]
	);

	if (steps.length === 0) return null;

	const handlers = {
		openBrandStarters: onOpenBrandStarters,
		openResultsHandoff: onOpenResultsHandoff,
		openListingWorkspace: onOpenListingWorkspace,
	} as const;

	return (
		<ProfessionalWorldsWorkspacePanel
			title={t('properties.mediaNextSteps.title')}
			dense
		>
			<p className="text-sm text-(--desktop-text-secondary)">
				{t('properties.mediaNextSteps.lead')}
			</p>
			<div className="flex flex-wrap gap-2">
				{steps.map((stepId) => (
					<DesktopAppButton
						key={stepId}
						variant="ghost"
						onClick={handlers[stepId]}
					>
						{t(listingMediaNextStepI18nKey(stepId))}
					</DesktopAppButton>
				))}
			</div>
		</ProfessionalWorldsWorkspacePanel>
	);
}
