/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map `ProfessionalWorldsWorkspaceContext` into `useRealtorObjectsWorkspace` host arguments.
 *
 * Invariants:
 * - Used only from `RealtorObjectsWorkspacePanel` inside the workspace provider.
 *
 * Related:
 * - ProfessionalWorldsWorkspaceContext.tsx
 * - useRealtorObjectsWorkspace.ts
 */

import type { TFunction } from 'i18next';

import type { ProfessionalWorldsWorkspaceContextValue } from '../ProfessionalWorldsWorkspaceContext';
import type { UseRealtorObjectsWorkspaceArgs } from './realtorObjects/types';

export function buildRealtorObjectsWorkspaceHost(
	ctx: ProfessionalWorldsWorkspaceContextValue,
	t: TFunction
): UseRealtorObjectsWorkspaceArgs {
	return {
		activeVerticalSlug: ctx.activeVerticalSlug,
		snapshot: ctx.snapshot,
		selectedPropertyId: ctx.selectedPropertyId,
		setSelectedPropertyId: ctx.setSelectedPropertyId,
		selectedProperty: ctx.selectedProperty,
		refresh: ctx.refresh,
		saving: ctx.saving,
		setSaving: ctx.setSaving,
		addArtifactToSnapshot: ctx.addArtifactToSnapshot,
		patchSnapshot: ctx.patchSnapshot,
		listingStream: ctx.listingStream,
		setLaneText: ctx.setLaneText,
		setLaneStatus: ctx.setLaneStatus,
		resolvedPhotoPresets: ctx.resolvedPhotoPresets,
		t,
	};
}
