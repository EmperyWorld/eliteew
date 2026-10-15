/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Composed state and handlers for the realtor objects/listing workspace (Professional Worlds).
 *
 * Invariants:
 * - Listing catalog API is realtor-scoped until a generic professional_objects layer exists.
 * - Heavy media/AI work runs only on explicit user actions inside this hook.
 *
 * Related:
 * - runtimePanels/RealtorObjectsWorkspacePanel.tsx
 * - hooks/realtorObjects/
 * - documentation/product/PROFESSIONAL-WORLDS.md
 */

import { useRealtorListingCrud } from './realtorObjects/useRealtorListingCrud';
import { useRealtorListingMedia } from './realtorObjects/useRealtorListingMedia';
import { useRealtorObjectIntake } from './realtorObjects/useRealtorObjectIntake';

export type {
	PropertiesWorkspaceTab,
	RealtorBatchUploadProgressRow,
	UseRealtorObjectsWorkspaceArgs,
} from './realtorObjects/types';

import type { UseRealtorObjectsWorkspaceArgs } from './realtorObjects/types';

export function useRealtorObjectsWorkspace(
	args: UseRealtorObjectsWorkspaceArgs
) {
	const crud = useRealtorListingCrud(args);
	const intake = useRealtorObjectIntake({
		patchSnapshot: args.patchSnapshot,
		setLaneStatus: args.setLaneStatus,
		setSaving: args.setSaving,
		setSelectedPropertyId: args.setSelectedPropertyId,
		setPropertyDraft: crud.setPropertyDraft,
		setInfrastructureCsv: crud.setInfrastructureCsv,
		t: args.t,
	});
	const media = useRealtorListingMedia({
		selectedPropertyId: args.selectedPropertyId,
		selectedProperty: args.selectedProperty,
		setLaneStatus: args.setLaneStatus,
		resolvedPhotoPresets: args.resolvedPhotoPresets,
		t: args.t,
	});

	return {
		...crud,
		...intake,
		...media,
		saving: args.saving,
	};
}
