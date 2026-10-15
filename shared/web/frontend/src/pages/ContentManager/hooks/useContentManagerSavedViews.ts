/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Saved view presets and hook for Content Manager quick filters.
 *
 * Invariants:
 * - Preset ids are stable (`unfiled`, `fromFriends`, `largeFiles`, `processingErrors`, `pdf`).
 * - `largeFiles` sorts by file_size desc with a minimum size threshold.
 *
 * Related:
 * - `hooks/useContentList.ts`
 */

import { useCallback, useMemo, useState } from 'react';
import type {
	FilterVisibility,
	SortField,
	SortOrder,
} from '../contentManagerTypes';

export type ContentManagerSavedViewId =
	| 'unfiled'
	| 'fromFriends'
	| 'largeFiles'
	| 'processingErrors'
	| 'pdf';

export type ContentManagerSavedViewFilters = {
	folderUnassignedOnly?: boolean;
	filterVisibility?: FilterVisibility;
	filterType?: string;
	sortField?: SortField;
	sortOrder?: SortOrder;
	minFileSize?: number;
	processingStatus?: string;
};

export type ContentManagerSavedViewPreset = {
	id: ContentManagerSavedViewId;
	filters: ContentManagerSavedViewFilters;
};

/** Minimum file size for the «large files» preset (10 MiB). */
export const LARGE_FILES_MIN_BYTES = 10 * 1024 * 1024;

export const CONTENT_MANAGER_SAVED_VIEW_PRESETS: readonly ContentManagerSavedViewPreset[] =
	[
		{
			id: 'unfiled',
			filters: {
				folderUnassignedOnly: true,
				sortField: 'updated_at',
				sortOrder: 'desc',
			},
		},
		{
			id: 'fromFriends',
			filters: {
				filterVisibility: 'from_friends',
				sortField: 'updated_at',
				sortOrder: 'desc',
			},
		},
		{
			id: 'largeFiles',
			filters: {
				sortField: 'file_size',
				sortOrder: 'desc',
				minFileSize: LARGE_FILES_MIN_BYTES,
			},
		},
		{
			id: 'processingErrors',
			filters: {
				processingStatus: 'failed',
				sortField: 'updated_at',
				sortOrder: 'desc',
			},
		},
		{
			id: 'pdf',
			filters: {
				filterType: 'pdf',
				sortField: 'name',
				sortOrder: 'asc',
			},
		},
	] as const;

const PRESET_BY_ID = new Map(
	CONTENT_MANAGER_SAVED_VIEW_PRESETS.map((p) => [p.id, p] as const)
);

export function getContentManagerSavedViewPreset(
	id: ContentManagerSavedViewId
): ContentManagerSavedViewPreset {
	const preset = PRESET_BY_ID.get(id);
	if (!preset) {
		throw new Error(`Unknown saved view: ${id}`);
	}
	return preset;
}

export function isContentManagerSavedViewId(
	value: string
): value is ContentManagerSavedViewId {
	return PRESET_BY_ID.has(value as ContentManagerSavedViewId);
}

export type UseContentManagerSavedViewsResult = {
	activeViewId: ContentManagerSavedViewId | null;
	activeFilters: ContentManagerSavedViewFilters | null;
	applyView: (id: ContentManagerSavedViewId) => ContentManagerSavedViewFilters;
	clearView: () => void;
	presets: readonly ContentManagerSavedViewPreset[];
};

export function useContentManagerSavedViews(): UseContentManagerSavedViewsResult {
	const [activeViewId, setActiveViewId] =
		useState<ContentManagerSavedViewId | null>(null);

	const activeFilters = useMemo(() => {
		if (!activeViewId) return null;
		return getContentManagerSavedViewPreset(activeViewId).filters;
	}, [activeViewId]);

	const applyView = useCallback((id: ContentManagerSavedViewId) => {
		setActiveViewId(id);
		return getContentManagerSavedViewPreset(id).filters;
	}, []);

	const clearView = useCallback(() => {
		setActiveViewId(null);
	}, []);

	return {
		activeViewId,
		activeFilters,
		applyView,
		clearView,
		presets: CONTENT_MANAGER_SAVED_VIEW_PRESETS,
	};
}
