/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin orchestrator for the Professional Worlds desktop app: navigation state, workspace context, and panel wiring.
 *
 * Invariants:
 * - Snapshot bootstrap and vertical activation live in `useProfessionalWorldsBootstrap`; chrome in `ProfessionalWorldsShell`.
 * - View-to-panel mapping is delegated to `ProfessionalWorldsViewRouter`.
 * - Heavy AI work mounts only when the user triggers generation in workspace panels.
 *
 * Related:
 * - ProfessionalWorldsShell.tsx
 * - ProfessionalWorldsViewRouter.tsx
 * - hooks/useProfessionalWorldsBootstrap.ts
 * - hooks/useProfessionalWorldsWorkspaceOrchestration.ts
 * - hooks/useProfessionalWorldsNavigationModel.ts
 * - documentation/product/PROFESSIONAL-WORLDS.md
 */

import { useCallback, useState } from 'react';

import { useDesktopGuideTourOpener } from '@/pages/Desktop/hooks/useDesktopGuideTourOpener';
import { isMobileProfessionalWorldsEmbeddedRoute } from '@/utils/mobileEmbeddedSpaRoute';

import { useProfessionalWorldsBootstrap } from './hooks/useProfessionalWorldsBootstrap';
import { useProfessionalWorldsNavigationModel } from './hooks/useProfessionalWorldsNavigationModel';
import { useProfessionalWorldsWorkspaceOrchestration } from './hooks/useProfessionalWorldsWorkspaceOrchestration';
import { ProfessionalWorldsShell } from './ProfessionalWorldsShell';
import { ProfessionalWorldsViewRouter } from './ProfessionalWorldsViewRouter';
import { PROFESSIONAL_WORLDS_GUIDE_VIEW_BY_STEP } from './professionalWorldsGuideConstants';

export default function ProfessionalWorldsApp({
	embeddedMobile,
}: {
	embeddedMobile?: boolean;
} = {}) {
	const embeddedMobileLayout =
		embeddedMobile ?? isMobileProfessionalWorldsEmbeddedRoute();
	const bootstrap = useProfessionalWorldsBootstrap();
	const {
		loading,
		error,
		runtimeNotice,
		activeVerticalSlug,
		activationBusySlug,
		activationError,
		refresh,
		handleVerticalToolbarPick,
		verticalToolbarOptions,
		snapshot,
	} = bootstrap;

	const workspace = useProfessionalWorldsWorkspaceOrchestration(
		bootstrap,
		embeddedMobileLayout
	);
	const {
		setActiveView,
		workspaceContextValue,
		viewRouterProps,
		navigationInput,
		activeView,
		navMode,
	} = workspace;
	const navigation = useProfessionalWorldsNavigationModel(navigationInput);

	const [guideOpen, setGuideOpen] = useState(false);
	const openGuideTour = useCallback(() => setGuideOpen(true), []);
	useDesktopGuideTourOpener(openGuideTour, { enabled: !embeddedMobileLayout });
	const prepareGuideStep = useCallback(
		(stepId: string) => {
			const view = PROFESSIONAL_WORLDS_GUIDE_VIEW_BY_STEP[stepId];
			if (view) setActiveView(view);
		},
		[setActiveView]
	);

	return (
		<ProfessionalWorldsShell
			activeView={activeView}
			activeVerticalSlug={activeVerticalSlug}
			embeddedMobileLayout={embeddedMobileLayout}
			loading={loading}
			error={error}
			runtimeNotice={runtimeNotice}
			navItems={navigation.navItems}
			navMode={navMode}
			navExpandSuggested={navigation.navExpandSuggested}
			snapshot={snapshot}
			nonRealtorVerticalNotice={navigation.nonRealtorVerticalNotice}
			backgroundStreamPeek={navigation.backgroundStreamPeek}
			verticalToolbarOptions={verticalToolbarOptions}
			activationError={activationError}
			activationBusySlug={activationBusySlug}
			guideOpen={guideOpen}
			onGuideClose={() => setGuideOpen(false)}
			onPrepareGuideStep={prepareGuideStep}
			onRefresh={() => void refresh()}
			onRetry={() => void refresh()}
			onSelectView={setActiveView}
			onSelectVertical={handleVerticalToolbarPick}
			onToggleNavMode={navigation.handleToggleNavMode}
			workspaceContextValue={workspaceContextValue}
		>
			<ProfessionalWorldsViewRouter {...viewRouterProps} />
		</ProfessionalWorldsShell>
	);
}
