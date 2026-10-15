/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React context for realtor objects workspace panel bindings (Wave 2b split).
 *
 * Invariants:
 * - Provider wraps desktop/mobile workspace render trees in `RealtorObjectsWorkspaceShell`.
 *
 * Related:
 * - RealtorObjectsWorkspaceShell.tsx
 */

import type { Content } from '@/components/UnifiedContent/types';
import type { TFunction } from 'i18next';
import {
	createContext,
	createElement,
	useContext,
	type Dispatch,
	type ReactNode,
	type RefObject,
	type SetStateAction,
} from 'react';

import type { ListingCoverEntry } from '../../hooks/useListingPrimaryUnifiedContentIds';
import type {
	ObjectIntakePreview,
	ProfessionalMediaAlbum,
	ProfessionalRuntimePhotoPreset,
	ProfessionalWorldsSnapshot,
	RealtorGenerationTone,
	RealtorProperty,
	RealtorPropertyCreate,
} from '../../types';
import type { ProfessionalWorldsWorkspaceContextValue } from '../../ProfessionalWorldsWorkspaceContext';
import type { RealtorBatchUploadProgressRow } from '../../hooks/realtorObjects/types';

export type RealtorObjectsPanelVm = {
	t: TFunction;
	fieldClassName: string;
	batchTargetAlbumSelectId: string;
	workspace: ProfessionalWorldsWorkspaceContextValue;
	propertyDraft: RealtorPropertyCreate;
	setPropertyDraft: Dispatch<SetStateAction<RealtorPropertyCreate>>;
	infrastructureCsv: string;
	setInfrastructureCsv: Dispatch<SetStateAction<string>>;
	tone: RealtorGenerationTone;
	setTone: Dispatch<SetStateAction<RealtorGenerationTone>>;
	mediaPickerItems: Content[];
	setMediaPickerItems: Dispatch<SetStateAction<Content[]>>;
	listingMediaRefreshAt: number | undefined;
	setListingMediaRefreshAt: Dispatch<SetStateAction<number | undefined>>;
	listingCoverStatesByPropertyId: Readonly<Record<string, ListingCoverEntry>>;
	registerListingCoverInterest: (propertyId: string) => void;
	workspaceListingThumbPending: boolean;
	uploadEnhanceInputRef: RefObject<HTMLInputElement | null>;
	mediaPipelineBusy: boolean;
	uploadProgressRows: RealtorBatchUploadProgressRow[];
	listingAlbums: ProfessionalMediaAlbum[];
	batchTargetAlbumId: string;
	setBatchTargetAlbumId: Dispatch<SetStateAction<string>>;
	objectIntakeText: string;
	setObjectIntakeText: Dispatch<SetStateAction<string>>;
	objectIntakePreview: ObjectIntakePreview | null;
	photoPresetKey: string;
	setPhotoPresetKey: Dispatch<SetStateAction<string>>;
	photoInstruction: string;
	setPhotoInstruction: Dispatch<SetStateAction<string>>;
	uploadWithoutProcessing: boolean;
	setUploadWithoutProcessing: Dispatch<SetStateAction<boolean>>;
	propertiesWorkspaceTab: import('../../hooks/realtorObjects/types').PropertiesWorkspaceTab;
	setPropertiesWorkspaceTab: Dispatch<
		SetStateAction<
			import('../../hooks/realtorObjects/types').PropertiesWorkspaceTab
		>
	>;
	lastCreatedProperty: { id: string; title: string } | null;
	clearLastCreatedProperty: () => void;
	handleCreateProperty: () => Promise<void>;
	handleUpdateSelectedProperty: () => Promise<void>;
	handleStream: (kind: 'description' | 'contentPack') => Promise<void>;
	handleObjectIntake: () => Promise<void>;
	handleCommitObjectIntake: () => Promise<void>;
	handleMultiPhotoUploadEnhance: (files: File[]) => Promise<void>;
	handleMediaLibraryBatch: (items: Content[], ids: string[]) => Promise<void>;
	resetPropertyDraft: () => RealtorPropertyCreate;
	saving: boolean;
	snapshot: ProfessionalWorldsSnapshot;
	selectedProperty: RealtorProperty | null;
	selectedPropertyId: string | null;
	setSelectedPropertyId: (id: string | null) => void;
	resolvedPhotoPresets: ProfessionalRuntimePhotoPreset[];
	mediaStudioEnabled: boolean;
	setLaneStatus: ProfessionalWorldsWorkspaceContextValue['setLaneStatus'];
	openClients: ProfessionalWorldsWorkspaceContextValue['openClients'];
	openCommunications: ProfessionalWorldsWorkspaceContextValue['openCommunications'];
	openProfessionTool: ProfessionalWorldsWorkspaceContextValue['openProfessionTool'];
	embeddedMobileLayout: boolean;
	communicationsModuleEnabled: boolean;
	showingsModuleEnabled: boolean;
	documentsModuleEnabled: boolean;
	marketingModuleEnabled: boolean;
	insightsModuleEnabled: boolean;
	selectedListingCommunicationFocus: ReturnType<
		typeof import('../../realtorLogic').resolveListingCommunicationFocus
	>;
	setPropertyDeleteTarget: Dispatch<
		SetStateAction<{ id: string; title: string } | null>
	>;
};

const RealtorObjectsPanelContext = createContext<RealtorObjectsPanelVm | null>(
	null
);

export function RealtorObjectsPanelProvider({
	value,
	children,
}: {
	value: RealtorObjectsPanelVm;
	children: ReactNode;
}) {
	return createElement(
		RealtorObjectsPanelContext.Provider,
		{ value },
		children
	);
}

export function useRealtorObjectsPanelVm(): RealtorObjectsPanelVm {
	const ctx = useContext(RealtorObjectsPanelContext);
	if (!ctx) {
		throw new Error(
			'useRealtorObjectsPanelVm requires RealtorObjectsPanelProvider'
		);
	}
	return ctx;
}
