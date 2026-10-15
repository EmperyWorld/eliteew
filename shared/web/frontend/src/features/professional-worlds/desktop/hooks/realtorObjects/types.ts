/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared types for the realtor objects/listing workspace hooks (Wave 2b split).
 *
 * Invariants:
 * - `UseRealtorObjectsWorkspaceArgs` shape matches `buildRealtorObjectsWorkspaceHost` output.
 *
 * Related:
 * - ../useRealtorObjectsWorkspace.ts
 * - ../useRealtorObjectsWorkspaceHost.ts
 */

import type { Dispatch, SetStateAction } from 'react';
import type { TFunction } from 'i18next';

import type {
	ObjectIntakePreview,
	ProfessionalArtifact,
	ProfessionalRuntimePhotoPreset,
	ProfessionalWorldsSnapshot,
	RealtorGenerationTone,
	RealtorProperty,
	RealtorPropertyCreate,
} from '../../types';

export type PropertiesWorkspaceTab =
	| 'newDraft'
	| 'savedListings'
	| 'listingWorkspace';

export type RealtorBatchUploadProgressRow = {
	id: string;
	fileName: string;
	status: 'queued' | 'processing' | 'done' | 'failed';
	message: string;
	outputContentId: string | null;
};

export type UseRealtorObjectsWorkspaceArgs = {
	activeVerticalSlug: string;
	snapshot: ProfessionalWorldsSnapshot;
	selectedPropertyId: string | null;
	setSelectedPropertyId: (id: string | null) => void;
	selectedProperty: RealtorProperty | null;
	refresh: (options?: { verticalSlug?: string }) => Promise<void>;
	saving: boolean;
	setSaving: (value: boolean) => void;
	addArtifactToSnapshot: (artifact?: ProfessionalArtifact) => void;
	listingStream: { text: string; status: string };
	setLaneText: (lane: 'listing' | 'brand' | 'learning', text: string) => void;
	setLaneStatus: (
		lane: 'listing' | 'brand' | 'learning',
		status: string
	) => void;
	resolvedPhotoPresets: ProfessionalRuntimePhotoPreset[];
	patchSnapshot: (
		recipe: (current: ProfessionalWorldsSnapshot) => ProfessionalWorldsSnapshot
	) => void;
	t: TFunction;
};

export type RealtorListingCrudState = {
	propertyDraft: RealtorPropertyCreate;
	setPropertyDraft: Dispatch<SetStateAction<RealtorPropertyCreate>>;
	resetPropertyDraft: () => RealtorPropertyCreate;
	infrastructureCsv: string;
	setInfrastructureCsv: Dispatch<SetStateAction<string>>;
	tone: RealtorGenerationTone;
	setTone: Dispatch<SetStateAction<RealtorGenerationTone>>;
	propertiesWorkspaceTab: PropertiesWorkspaceTab;
	setPropertiesWorkspaceTab: Dispatch<SetStateAction<PropertiesWorkspaceTab>>;
	lastCreatedProperty: { id: string; title: string } | null;
	clearLastCreatedProperty: () => void;
	handleCreateProperty: () => Promise<void>;
	handleUpdateSelectedProperty: () => Promise<void>;
	handleStream: (kind: 'description' | 'contentPack') => Promise<void>;
};

export type RealtorObjectIntakeState = {
	objectIntakeText: string;
	setObjectIntakeText: Dispatch<SetStateAction<string>>;
	objectIntakePreview: ObjectIntakePreview | null;
	setObjectIntakePreview: Dispatch<SetStateAction<ObjectIntakePreview | null>>;
	handleObjectIntake: () => Promise<void>;
	handleCommitObjectIntake: () => Promise<void>;
};
