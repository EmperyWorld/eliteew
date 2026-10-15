/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Maps Professional Worlds active view to workspace panels and the shared AI output rail.
 *
 * Invariants:
 * - Panels mount only when runtime config is present and the view/module gate allows them.
 * - Profile and clients panels receive draft state from the app orchestrator, not from bootstrap alone.
 *
 * Related:
 * - ProfessionalWorldsApp.tsx
 * - runtimePanels/*
 */

import type { Dispatch, SetStateAction } from 'react';

import { completeLearningLesson } from './api';
import { markLessonCompletedInSnapshot } from './professionalWorldsSnapshotUtils';
import { ArtifactsWorkspacePanel } from './runtimePanels/ArtifactsWorkspacePanel';
import { BrandWorkspacePanel } from './runtimePanels/BrandWorkspacePanel';
import { ClientsWorkspacePanel } from './runtimePanels/ClientsWorkspacePanel';
import { LearningWorkspacePanel } from './runtimePanels/LearningWorkspacePanel';
import { OverviewWorkspacePanel } from './runtimePanels/OverviewWorkspacePanel';
import { PlaybooksWorkspacePanel } from './runtimePanels/PlaybooksWorkspacePanel';
import { ProfessionToolsWorkspacePanel } from './runtimePanels/ProfessionToolsWorkspacePanel';
import { ProfileWorkspacePanel } from './runtimePanels/ProfileWorkspacePanel';
import { ProfessionalWorldsAiOutputRail } from './runtimePanels/ProfessionalWorldsAiOutputRail';
import { RealtorObjectsWorkspacePanel } from './runtimePanels/RealtorObjectsWorkspacePanel';
import type { ProfessionalWorldsActiveView } from './ProfessionalWorldsWorkspaceContext';
import type { ROLEPLAY_SCENARIOS } from './realtorLogic';
import type {
	ProfessionalClientCreate,
	ProfessionalDealCreate,
	ProfessionalWorldsSnapshot,
	SpecialistProfileUpsert,
} from './types';

export type ProfessionalWorldsViewRouterProps = {
	activeView: ProfessionalWorldsActiveView;
	activeVerticalSlug: string;
	hasRuntime: boolean;
	listingWorkspaceEnabled: boolean;
	snapshot: ProfessionalWorldsSnapshot;
	patchSnapshot: (
		recipe: (current: ProfessionalWorldsSnapshot) => ProfessionalWorldsSnapshot
	) => void;
	profileBanner: { kind: 'success' | 'error'; text: string } | null;
	profileDraft: SpecialistProfileUpsert;
	setProfileDraft: Dispatch<SetStateAction<SpecialistProfileUpsert>>;
	saving: boolean;
	onSaveProfile: () => void | Promise<void>;
	clientDraft: ProfessionalClientCreate;
	setClientDraft: Dispatch<SetStateAction<ProfessionalClientCreate>>;
	dealDraft: ProfessionalDealCreate;
	setDealDraft: Dispatch<SetStateAction<ProfessionalDealCreate>>;
	clientsBanner: { kind: 'success' | 'error'; text: string } | null;
	onCreateClient: () => void | Promise<void>;
	onCreateDeal: () => void | Promise<void>;
	onStartCoach: (
		scenario: (typeof ROLEPLAY_SCENARIOS)[number],
		message: string
	) => void | Promise<void>;
};

export function ProfessionalWorldsViewRouter({
	activeView,
	activeVerticalSlug,
	hasRuntime,
	listingWorkspaceEnabled,
	snapshot,
	patchSnapshot,
	profileBanner,
	profileDraft,
	setProfileDraft,
	saving,
	onSaveProfile,
	clientDraft,
	setClientDraft,
	dealDraft,
	setDealDraft,
	clientsBanner,
	onCreateClient,
	onCreateDeal,
	onStartCoach,
}: ProfessionalWorldsViewRouterProps) {
	if (!hasRuntime) {
		return null;
	}

	return (
		<>
			{activeView === 'overview' && <OverviewWorkspacePanel />}
			{activeView === 'profile' && (
				<ProfileWorkspacePanel
					profileBanner={profileBanner}
					profileDraft={profileDraft}
					saving={saving}
					setProfileDraft={setProfileDraft}
					onSaveProfile={onSaveProfile}
				/>
			)}
			{activeView === 'properties' && listingWorkspaceEnabled && (
				<RealtorObjectsWorkspacePanel />
			)}
			{activeView === 'clients' && (
				<ClientsWorkspacePanel
					activeVerticalSlug={activeVerticalSlug}
					clientDraft={clientDraft}
					clientsBanner={clientsBanner}
					dealDraft={dealDraft}
					saving={saving}
					setClientDraft={setClientDraft}
					setDealDraft={setDealDraft}
					snapshot={snapshot}
					onCreateClient={onCreateClient}
					onCreateDeal={onCreateDeal}
				/>
			)}
			{activeView === 'professionTools' && <ProfessionToolsWorkspacePanel />}
			{activeView === 'learning' && (
				<LearningWorkspacePanel
					courses={snapshot.courses}
					onCompleteLesson={async (lessonId) => {
						await completeLearningLesson(lessonId);
						patchSnapshot((current) =>
							markLessonCompletedInSnapshot(current, lessonId)
						);
					}}
					onStartCoach={onStartCoach}
				/>
			)}
			{activeView === 'brand' && <BrandWorkspacePanel />}
			{activeView === 'playbooks' && <PlaybooksWorkspacePanel />}
			{activeView === 'artifacts' && <ArtifactsWorkspacePanel />}
			<div data-pw-guide="ai-rail">
				<ProfessionalWorldsAiOutputRail />
			</div>
		</>
	);
}
