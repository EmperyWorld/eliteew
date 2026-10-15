/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop chrome for Professional Worlds: runtime shell, sidebar nav, context strip, and provider health banners.
 *
 * Invariants:
 * - Workspace context provider wraps in-shell content so context strip and panels share navigation state.
 * - Embedded mobile skips the spotlight guide modal; desktop keeps guide wiring.
 *
 * Related:
 * - ProfessionalWorldsApp.tsx
 * - ProfessionalWorldsRuntimeShell.tsx
 * - ProfessionalWorldsWorkspaceContext.tsx
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { guideTourLabelsFromI18n } from '@/components/guided-tour/guideTourLabelsFromI18n';
import { SpotlightGuideModal } from '@/components/guided-tour/SpotlightGuideModal';
import { useBuiltGuideSteps } from '@/components/guided-tour/useBuiltGuideSteps';
import {
	DesktopAppButton,
	DesktopAppEmptyState,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import {
	type BackgroundStreamPeek,
	ProfessionalWorldsBackgroundStreamBanner,
} from './components/ProfessionalWorldsBackgroundStreamBanner';
import { ProfessionalWorldsActiveContextStrip } from './components/ProfessionalWorldsActiveContextStrip';
import { ProfessionalWorldsStatusBanner } from './layout';
import { RuntimeSetupHintPanel } from './runtimePanels/RuntimeSetupHintPanel';
import {
	ProfessionalWorldsWorkspaceProvider,
	type ProfessionalWorldsActiveView,
	type ProfessionalWorldsWorkspaceContextValue,
} from './ProfessionalWorldsWorkspaceContext';
import {
	type ProfessionalWorldsRuntimeNavItem,
	ProfessionalWorldsRuntimeShell,
} from './ProfessionalWorldsRuntimeShell';
import type { ProfessionalWorldsNavMode } from './professionalWorldsNavMode';
import type { ProfessionalWorldsSnapshot } from './types';
import {
	PROFESSIONAL_WORLDS_GUIDE_AUDIO_LS_KEY,
	PROFESSIONAL_WORLDS_GUIDE_ROOT_ID,
	PROFESSIONAL_WORLDS_GUIDE_STEP_DEFS,
	PROFESSIONAL_WORLDS_GUIDE_TOUR_FOLDER,
} from './professionalWorldsGuideConstants';

export type ProfessionalWorldsShellProps = {
	activeView: ProfessionalWorldsActiveView;
	activeVerticalSlug: string;
	embeddedMobileLayout: boolean;
	loading: boolean;
	error: string | null;
	runtimeNotice: string | null;
	navItems: ProfessionalWorldsRuntimeNavItem<ProfessionalWorldsActiveView>[];
	navMode: ProfessionalWorldsNavMode;
	navExpandSuggested: boolean;
	snapshot: ProfessionalWorldsSnapshot;
	nonRealtorVerticalNotice: string | null;
	backgroundStreamPeek: BackgroundStreamPeek | null;
	verticalToolbarOptions: {
		slug: string;
		label: string;
		needsActivation: boolean;
	}[];
	activationError: string | null;
	activationBusySlug: string | null;
	guideOpen: boolean;
	onGuideClose: () => void;
	onPrepareGuideStep: (stepId: string) => void;
	onRefresh: () => void;
	onRetry: () => void;
	onSelectView: (view: ProfessionalWorldsActiveView) => void;
	onSelectVertical: (slug: string) => void;
	onToggleNavMode: () => void;
	workspaceContextValue: ProfessionalWorldsWorkspaceContextValue;
	children: ReactNode;
};

export function ProfessionalWorldsShell({
	activeView,
	activeVerticalSlug,
	embeddedMobileLayout,
	loading,
	error,
	runtimeNotice,
	navItems,
	navMode,
	navExpandSuggested,
	snapshot,
	nonRealtorVerticalNotice,
	backgroundStreamPeek,
	verticalToolbarOptions,
	activationError,
	activationBusySlug,
	guideOpen,
	onGuideClose,
	onPrepareGuideStep,
	onRefresh,
	onRetry,
	onSelectView,
	onSelectVertical,
	onToggleNavMode,
	workspaceContextValue,
	children,
}: ProfessionalWorldsShellProps) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const guideLabels = guideTourLabelsFromI18n(t, 'guide');
	const guideSteps = useBuiltGuideSteps(
		t,
		'guide.steps',
		PROFESSIONAL_WORLDS_GUIDE_STEP_DEFS
	);

	return (
		<>
			<ProfessionalWorldsRuntimeShell
				activeView={activeView}
				activeVerticalSlug={activeVerticalSlug}
				embeddedMobile={embeddedMobileLayout}
				error={error}
				errorTitle={t('errors.title')}
				guideRootId={PROFESSIONAL_WORLDS_GUIDE_ROOT_ID}
				loading={loading}
				navItems={navItems}
				navLabel={t('nav.label')}
				onRefresh={onRefresh}
				onRetry={onRetry}
				onSelectView={onSelectView}
				onSelectVertical={onSelectVertical}
				onToggleNavMode={onToggleNavMode}
				navMode={navMode}
				navModeToggleLabel={
					navMode === 'compact' ? t('nav.modeFull') : t('nav.modeCompact')
				}
				refreshLabel={t('actions.refresh')}
				retryLabel={t('actions.retry')}
				runtimeNotice={runtimeNotice}
				safetyBody={t('safety.body')}
				safetyTitle={t('safety.title')}
				subtitle={t('subtitle')}
				title={t('title')}
				verticalOptgroupLabels={{
					active: t('runtime.verticalOptgroupActive'),
					connect: t('runtime.verticalOptgroupConnect'),
				}}
				verticalOptions={verticalToolbarOptions}
				verticalSelectAriaLabel={t('runtime.verticalSelectAria')}
				verticalToolbarAlert={activationError}
				verticalToolbarDisabled={loading || activationBusySlug !== null}
			>
				<ProfessionalWorldsWorkspaceProvider value={workspaceContextValue}>
					<div className="grid gap-3">
						{backgroundStreamPeek ? (
							<ProfessionalWorldsBackgroundStreamBanner
								activePeek={backgroundStreamPeek}
							/>
						) : null}
						{snapshot.providerHealth?.degraded ? (
							<ProfessionalWorldsStatusBanner kind="warning" role="alert">
								{snapshot.providerHealth.message ||
									t('runtime.ugsDegradedBanner')}
							</ProfessionalWorldsStatusBanner>
						) : null}
						{snapshot.runtimeConfigs.length > 0 ? (
							<ProfessionalWorldsActiveContextStrip />
						) : null}
						{nonRealtorVerticalNotice ? (
							<ProfessionalWorldsStatusBanner kind="info">
								{nonRealtorVerticalNotice}
							</ProfessionalWorldsStatusBanner>
						) : null}
						{snapshot.runtimeConfigs.length === 0 &&
						snapshot.verticals.length === 0 ? (
							<DesktopAppEmptyState
								description={t('activationGate.noCatalogBody')}
								title={t('activationGate.noCatalogTitle')}
							/>
						) : null}
						{snapshot.runtimeConfigs.length === 0 &&
						snapshot.verticals.length > 0 ? (
							<RuntimeSetupHintPanel />
						) : null}
						{snapshot.runtimeConfigs.length > 0 &&
						activeView === 'overview' &&
						navMode === 'compact' &&
						navExpandSuggested ? (
							<ProfessionalWorldsStatusBanner kind="info">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<span>{t('nav.expandHint')}</span>
									<DesktopAppButton
										size="sm"
										variant="ghost"
										onClick={onToggleNavMode}
									>
										{t('nav.modeFull')}
									</DesktopAppButton>
								</div>
							</ProfessionalWorldsStatusBanner>
						) : null}
						{children}
					</div>
				</ProfessionalWorldsWorkspaceProvider>
			</ProfessionalWorldsRuntimeShell>
			{!embeddedMobileLayout ? (
				<SpotlightGuideModal
					open={guideOpen}
					onClose={onGuideClose}
					rootId={PROFESSIONAL_WORLDS_GUIDE_ROOT_ID}
					steps={guideSteps}
					audioLocalStorageKey={PROFESSIONAL_WORLDS_GUIDE_AUDIO_LS_KEY}
					tourAudioFolder={PROFESSIONAL_WORLDS_GUIDE_TOUR_FOLDER}
					labels={guideLabels}
					onPrepareStep={onPrepareGuideStep}
					spotlightLayoutKey={`${activeView}-${guideOpen}`}
					dialogTitleId="professional-worlds-guide-title"
				/>
			) : null}
		</>
	);
}
