/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Batch upload and library attach pipelines for realtor listing media (extracted from host hook).
 *
 * Invariants:
 * - Pipelines run only on explicit user actions; per-file status rows reflect progress.
 *
 * Related:
 * - useRealtorListingMedia.ts
 * - runtimePanels/realtorObjects/ListingWorkspaceMediaPanel.tsx
 */

import type { Content } from '@/components/UnifiedContent/types';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback } from 'react';
import type { TFunction } from 'i18next';

import {
	attachRealtorPropertyMedia,
	listMediaEnhancementJobs,
	patchProfessionalMediaAlbum,
	streamMediaEnhancement,
	streamMediaUploadEnhancement,
	uploadRealtorPropertyMedia,
} from '../../api';
import type { ProfessionalMediaAlbum, RealtorProperty } from '../../types';

import type { RealtorBatchUploadProgressRow } from './types';

export type UseRealtorListingMediaUploadArgs = {
	selectedProperty: RealtorProperty | null;
	setLaneStatus: (
		lane: 'listing' | 'brand' | 'learning',
		status: string
	) => void;
	t: TFunction;
	batchTargetAlbumId: string;
	listingAlbums: ProfessionalMediaAlbum[];
	photoInstruction: string;
	photoPresetKey: string;
	uploadWithoutProcessing: boolean;
	setMediaPipelineBusy: Dispatch<SetStateAction<boolean>>;
	setUploadProgressRows: Dispatch<
		SetStateAction<RealtorBatchUploadProgressRow[]>
	>;
	setListingMediaRefreshAt: Dispatch<SetStateAction<number | undefined>>;
};

export function useRealtorListingMediaUpload({
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
}: UseRealtorListingMediaUploadArgs) {
	const handleMultiPhotoUploadEnhance = useCallback(
		async (files: File[]) => {
			if (
				!selectedProperty ||
				files.length === 0 ||
				(!uploadWithoutProcessing && !photoPresetKey)
			)
				return;
			setMediaPipelineBusy(true);
			try {
				setLaneStatus('listing', t('stream.starting'));
				let attempted = 0;
				let failures = 0;
				const outputIdsForAlbum: string[] = [];
				const rows: RealtorBatchUploadProgressRow[] = files
					.filter((file): file is File => Boolean(file))
					.map((file, index) => ({
						id: `upload-${Date.now()}-${index}`,
						fileName: file.name,
						status: 'queued',
						message: t('properties.uploadQueued'),
						outputContentId: null,
					}));
				setUploadProgressRows(rows);

				const setRow = (
					rowId: string,
					patch: Partial<RealtorBatchUploadProgressRow>
				) => {
					setUploadProgressRows((current) =>
						current.map((row) =>
							row.id === rowId ? { ...row, ...patch } : row
						)
					);
				};

				for (let i = 0; i < files.length; i += 1) {
					const image = files[i];
					if (!image) continue;
					attempted += 1;
					const row = rows[i];
					if (!row) continue;
					let rowHadError = false;
					let rowOutputId: string | null = null;
					try {
						if (uploadWithoutProcessing) {
							const attached = await uploadRealtorPropertyMedia(
								selectedProperty.id,
								{
									image,
									caption: null,
								}
							);
							const outId = attached.unified_content_id;
							if (outId) {
								rowOutputId = String(outId).trim();
							}
							setRow(row.id, {
								status: 'done',
								message: t('properties.uploadDone'),
								outputContentId: null,
							});
						} else {
							await streamMediaUploadEnhancement(
								selectedProperty.id,
								{
									image,
									preset_key: photoPresetKey,
									instruction: photoInstruction.trim() || null,
									attach_on_complete: true,
								},
								{
									onStarted: (requestId: string) => {
										setLaneStatus(
											'listing',
											`${t('stream.started')} ${requestId}`
										);
										setRow(row.id, {
											status: 'processing',
											message: t('properties.uploadStarted'),
										});
									},
									onProgress: (message: string) => {
										setLaneStatus('listing', message);
										setRow(row.id, {
											status: 'processing',
											message,
										});
									},
									onRawResult: (data) => {
										const content = data.content;
										if (
											content &&
											typeof content === 'object' &&
											'content_id' in content
										) {
											rowOutputId = String(
												(content as { content_id?: unknown }).content_id ?? ''
											).trim();
										}
									},
									onResult: () => {
										void listMediaEnhancementJobs(selectedProperty.id);
										setRow(row.id, {
											status: 'done',
											message: t('properties.uploadDone'),
											outputContentId: rowOutputId,
										});
									},
									onError: (message: string) => {
										rowHadError = true;
										setLaneStatus(
											'listing',
											`${t('stream.error')}: ${message}`
										);
										setRow(row.id, {
											status: 'failed',
											message,
										});
									},
								}
							);
						}
						if (rowHadError) {
							failures += 1;
						} else if (rowOutputId) {
							outputIdsForAlbum.push(rowOutputId);
						}
					} catch (caught: unknown) {
						failures += 1;
						const msg =
							caught instanceof Error
								? caught.message
								: typeof caught === 'string'
									? caught
									: t('errors.load');
						setLaneStatus('listing', `${t('stream.error')}: ${msg}`);
						setRow(row.id, {
							status: 'failed',
							message: msg,
						});
					}
				}
				if (
					batchTargetAlbumId &&
					outputIdsForAlbum.length > 0 &&
					listingAlbums.some((album) => album.id === batchTargetAlbumId)
				) {
					const currentAlbum = listingAlbums.find(
						(album) => album.id === batchTargetAlbumId
					);
					const existing = (currentAlbum?.unified_content_ids ?? []).filter(
						(id): id is string => typeof id === 'string'
					);
					const merged = Array.from(
						new Set([...existing, ...outputIdsForAlbum])
					);
					await patchProfessionalMediaAlbum(batchTargetAlbumId, {
						unified_content_ids: merged,
					});
				}
				setListingMediaRefreshAt(Date.now());
				if (attempted === 0) {
					return;
				}
				if (failures === 0) {
					setLaneStatus('listing', t('properties.batchUploadDone'));
				} else if (failures === attempted) {
					setLaneStatus('listing', t('properties.batchUploadAllFailed'));
				} else {
					setLaneStatus(
						'listing',
						t('properties.batchUploadPartial', {
							failed: failures,
							total: attempted,
						})
					);
				}
			} finally {
				setMediaPipelineBusy(false);
			}
		},
		[
			batchTargetAlbumId,
			listingAlbums,
			photoInstruction,
			photoPresetKey,
			uploadWithoutProcessing,
			selectedProperty,
			setLaneStatus,
			setListingMediaRefreshAt,
			setMediaPipelineBusy,
			setUploadProgressRows,
			t,
		]
	);

	const handleMediaLibraryBatch = useCallback(
		async (items: Content[], ids: string[]) => {
			if (!selectedProperty || ids.length === 0) return;
			if (!uploadWithoutProcessing && !photoPresetKey) return;

			setMediaPipelineBusy(true);
			try {
				setLaneStatus('listing', t('stream.starting'));
				let attempted = 0;
				let failures = 0;
				const outputIdsForAlbum: string[] = [];

				const rows: RealtorBatchUploadProgressRow[] = ids
					.filter((id): id is string => Boolean(id))
					.map((id, index) => {
						const item = items[index];
						const fileName = item?.title || item?.name || item?.id || id;
						return {
							id: `library-${Date.now()}-${index}`,
							fileName: String(fileName),
							status: 'queued',
							message: t('properties.uploadQueued'),
							outputContentId: null,
						};
					});
				setUploadProgressRows(rows);

				const setRow = (
					rowId: string,
					patch: Partial<RealtorBatchUploadProgressRow>
				) => {
					setUploadProgressRows((current) =>
						current.map((row) =>
							row.id === rowId ? { ...row, ...patch } : row
						)
					);
				};

				for (let i = 0; i < ids.length; i += 1) {
					const contentId = ids[i];
					if (!contentId) continue;
					attempted += 1;
					const row = rows[i];
					if (!row) continue;

					let rowHadError = false;
					let rowFailureCounted = false;
					let rowOutputId: string | null = null;
					try {
						if (uploadWithoutProcessing) {
							await attachRealtorPropertyMedia(selectedProperty.id, {
								unified_content_id: contentId,
								caption: null,
								sort_order: 0,
							});
							rowOutputId = contentId;
							setRow(row.id, {
								status: 'done',
								message: t('properties.uploadDone'),
								outputContentId: null,
							});
						} else {
							await streamMediaEnhancement(
								selectedProperty.id,
								{
									content_id: contentId,
									preset_key: photoPresetKey,
									instruction: photoInstruction.trim() || null,
									attach_on_complete: true,
								},
								{
									onStarted: (requestId: string) => {
										setLaneStatus(
											'listing',
											`${t('stream.started')} ${requestId}`
										);
										setRow(row.id, {
											status: 'processing',
											message: t('properties.uploadStarted'),
										});
									},
									onProgress: (message: string) => {
										setLaneStatus('listing', message);
										setRow(row.id, {
											status: 'processing',
											message,
										});
									},
									onRawResult: (data: Record<string, unknown>) => {
										const content =
											data && typeof data === 'object' && 'content' in data
												? (data as Record<string, unknown>).content
												: undefined;
										const cid =
											content &&
											typeof content === 'object' &&
											'content_id' in content
												? String(
														(content as Record<string, unknown>).content_id ??
															''
													).trim()
												: '';
										if (cid) rowOutputId = cid;
									},
									onResult: () => {
										void listMediaEnhancementJobs(selectedProperty.id);
										setRow(row.id, {
											status: 'done',
											message: t('properties.uploadDone'),
											outputContentId: rowOutputId,
										});
									},
									onError: (message: string) => {
										rowHadError = true;
										setLaneStatus(
											'listing',
											`${t('stream.error')}: ${message}`
										);
										setRow(row.id, {
											status: 'failed',
											message,
										});
									},
								}
							);
						}
					} catch (caught: unknown) {
						rowHadError = true;
						failures += 1;
						rowFailureCounted = true;
						const msg =
							caught instanceof Error
								? caught.message
								: typeof caught === 'string'
									? caught
									: t('errors.load');
						setLaneStatus('listing', `${t('stream.error')}: ${msg}`);
						setRow(row.id, {
							status: 'failed',
							message: msg,
						});
					}

					if (rowHadError) {
						if (!rowFailureCounted) {
							failures += 1;
						}
					} else if (rowOutputId) {
						outputIdsForAlbum.push(rowOutputId);
					}
				}

				if (
					batchTargetAlbumId &&
					outputIdsForAlbum.length > 0 &&
					listingAlbums.some((album) => album.id === batchTargetAlbumId)
				) {
					const currentAlbum = listingAlbums.find(
						(album) => album.id === batchTargetAlbumId
					);
					const existing = (currentAlbum?.unified_content_ids ?? []).filter(
						(id): id is string => typeof id === 'string'
					);
					const merged = Array.from(
						new Set([...existing, ...outputIdsForAlbum])
					);
					await patchProfessionalMediaAlbum(batchTargetAlbumId, {
						unified_content_ids: merged,
					});
				}

				setListingMediaRefreshAt(Date.now());
				if (attempted === 0) return;
				if (failures === 0) {
					setLaneStatus('listing', t('properties.batchUploadDone'));
				} else if (failures === attempted) {
					setLaneStatus('listing', t('properties.batchUploadAllFailed'));
				} else {
					setLaneStatus(
						'listing',
						t('properties.batchUploadPartial', {
							failed: failures,
							total: attempted,
						})
					);
				}
			} finally {
				setMediaPipelineBusy(false);
			}
		},
		[
			batchTargetAlbumId,
			listingAlbums,
			photoInstruction,
			photoPresetKey,
			selectedProperty,
			setLaneStatus,
			setListingMediaRefreshAt,
			setMediaPipelineBusy,
			setUploadProgressRows,
			t,
			uploadWithoutProcessing,
		]
	);

	return {
		handleMultiPhotoUploadEnhance,
		handleMediaLibraryBatch,
	};
}
