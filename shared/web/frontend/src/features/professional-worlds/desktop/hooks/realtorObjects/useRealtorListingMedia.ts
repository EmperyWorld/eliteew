/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Listing media upload, library batch, albums, and enhancement pipeline state for realtor objects.
 *
 * Invariants:
 * - Media pipelines run only on explicit user actions; batch rows reflect per-file status.
 *
 * Related:
 * - useRealtorObjectsWorkspace.ts
 * - runtimePanels/realtorObjects/ListingWorkspaceMediaPanel.tsx
 * - useRealtorListingMediaUpload.ts
 */

import type { Content } from '@/components/UnifiedContent/types';
import { useEffect, useRef, useState } from 'react';

import { listProfessionalMediaAlbums } from '../../api';
import { PW_FALLBACK_PHOTO_PRESETS } from '../../ProfessionalMediaWorkbench';
import { albumBelongsToProperty } from '../../utils/professionalWorldsFormUtils';
import type { ProfessionalMediaAlbum } from '../../types';

import type {
	RealtorBatchUploadProgressRow,
	UseRealtorObjectsWorkspaceArgs,
} from './types';
import { useRealtorListingMediaUpload } from './useRealtorListingMediaUpload';

export function useRealtorListingMedia({
	selectedPropertyId,
	selectedProperty,
	setLaneStatus,
	resolvedPhotoPresets,
	t,
}: Pick<
	UseRealtorObjectsWorkspaceArgs,
	| 'selectedPropertyId'
	| 'selectedProperty'
	| 'setLaneStatus'
	| 'resolvedPhotoPresets'
	| 't'
>) {
	const [mediaContentId, setMediaContentId] = useState('');
	const [mediaPickerItems, setMediaPickerItems] = useState<Content[]>([]);
	const [listingMediaRefreshAt, setListingMediaRefreshAt] = useState<
		number | undefined
	>(undefined);
	const uploadEnhanceInputRef = useRef<HTMLInputElement>(null);
	const [mediaPipelineBusy, setMediaPipelineBusy] = useState(false);
	const [uploadProgressRows, setUploadProgressRows] = useState<
		RealtorBatchUploadProgressRow[]
	>([]);
	const [listingAlbums, setListingAlbums] = useState<ProfessionalMediaAlbum[]>(
		[]
	);
	const [batchTargetAlbumId, setBatchTargetAlbumId] = useState('');
	const [mediaCaption, setMediaCaption] = useState('');
	const [photoPresetKey, setPhotoPresetKey] = useState(
		resolvedPhotoPresets[0]?.preset_key ??
			PW_FALLBACK_PHOTO_PRESETS[0]?.preset_key ??
			''
	);
	const [photoInstruction, setPhotoInstruction] = useState('');
	const [uploadWithoutProcessing, setUploadWithoutProcessing] = useState(true);

	useEffect(() => {
		void selectedPropertyId;
		setMediaContentId('');
		setMediaCaption('');
		setMediaPickerItems([]);
		setMediaPipelineBusy(false);
	}, [selectedPropertyId]);

	useEffect(() => {
		const keys = resolvedPhotoPresets.map((preset) => preset.preset_key);
		setPhotoPresetKey((previous) =>
			keys.includes(previous) ? previous : (keys[0] ?? '')
		);
	}, [resolvedPhotoPresets]);

	useEffect(() => {
		if (!selectedProperty) {
			setListingAlbums([]);
			setBatchTargetAlbumId('');
			return;
		}
		let isActive = true;
		void listProfessionalMediaAlbums()
			.then((albums) => {
				if (!isActive) return;
				const filtered = albums.filter((album) =>
					albumBelongsToProperty(album.property_id, selectedProperty.id)
				);
				setListingAlbums(filtered);
				setBatchTargetAlbumId((previous) =>
					previous && filtered.some((album) => album.id === previous)
						? previous
						: ''
				);
			})
			.catch(() => {
				if (!isActive) return;
				setListingAlbums([]);
				setBatchTargetAlbumId('');
			});
		return () => {
			isActive = false;
		};
	}, [selectedProperty]);

	const { handleMultiPhotoUploadEnhance, handleMediaLibraryBatch } =
		useRealtorListingMediaUpload({
			selectedProperty,
			setLaneStatus,
			t,
			batchTargetAlbumId,
			listingAlbums,
			photoInstruction,
			photoPresetKey,
			uploadWithoutProcessing,
			setMediaPipelineBusy,
			setUploadProgressRows,
			setListingMediaRefreshAt,
		});

	return {
		mediaContentId,
		setMediaContentId,
		mediaPickerItems,
		setMediaPickerItems,
		listingMediaRefreshAt,
		setListingMediaRefreshAt,
		uploadEnhanceInputRef,
		mediaPipelineBusy,
		uploadProgressRows,
		listingAlbums,
		batchTargetAlbumId,
		setBatchTargetAlbumId,
		mediaCaption,
		setMediaCaption,
		photoPresetKey,
		setPhotoPresetKey,
		photoInstruction,
		setPhotoInstruction,
		uploadWithoutProcessing,
		setUploadWithoutProcessing,
		handleMultiPhotoUploadEnhance,
		handleMediaLibraryBatch,
	};
}
