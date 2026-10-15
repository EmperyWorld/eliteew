/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Publish-time version conflict state for companion embedded document editor (409 handling).
 *
 * Invariants:
 * - Force-save path remains explicit; reload uses server document snapshot when present.
 *
 * Related:
 * - CompanionDocumentEditorMode.tsx
 */

import { useCallback, useState } from 'react';

import type { EwaCompanionSurfaceDocument } from '@/services/ewa/ewaCompanionDocumentSurfaceApi';

export type CompanionDocumentSaveConflict = {
	expectedVersion: number;
	currentVersion: number;
	serverDocument: EwaCompanionSurfaceDocument | null;
};

export function useCompanionDocumentSaveConflict() {
	const [saveConflict, setSaveConflict] =
		useState<CompanionDocumentSaveConflict | null>(null);

	const clearSaveConflict = useCallback(() => setSaveConflict(null), []);

	return {
		saveConflict,
		setSaveConflict,
		clearSaveConflict,
	};
}
