/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * State, effects, and mutation handlers for ProfessionalMediaWorkbench —
 * listing media, batch SSE, albums, and brand kit — without JSX.
 *
 * Invariants:
 * - Consultant context never calls realtor media APIs.
 * - Albums 503 `db_schema_migration` surfaces one notice then keeps an empty list.
 * - Brand kit PUT only after local `validateProfessionalBrandKitDraft` passes.
 *
 * Related:
 * - media/realtorMediaAdapter.ts
 * - ProfessionalMediaWorkbench.tsx
 */

import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { validateProfessionalBrandKitDraft } from '../brandVisualKitForm';
import {
	type ProfessionalBatchItemProgressRow,
	reduceProfessionalBatchSseMaps,
} from '../mediaBatchMapper';
import {
	createProfessionalMediaAlbum,
	createRealtorMediaBatch,
	deleteProfessionalMediaAlbum,
	deleteRealtorPropertyMedia,
	getBrandVisualKit,
	getRealtorMediaBatchDetail,
	listProfessionalMediaAlbums,
	listRealtorPropertyMedia,
	patchProfessionalMediaAlbum,
	putBrandVisualKit,
	reviewRealtorMediaBatchItem,
	streamRealtorMediaBatchRun,
} from '../media/realtorMediaAdapter';
import type {
	ProfessionalMediaAlbum,
	RealtorMediaBatchDetail,
	RealtorPropertyMedia,
} from '../types';
import { PW_FALLBACK_PHOTO_PRESETS } from './constants';
import {
	albumBelongsToProperty,
	createIdempotencyKey,
	isAlbumsSchemaMigrationError,
	parseBrandKitDraftFromApi,
} from './helpers';
import type {
	MediaWorkbenchBrandDraft,
	ProfessionalMediaWorkbenchProps,
} from './types';

export function useProfessionalMediaWorkbench(
	props: ProfessionalMediaWorkbenchProps
) {
	const {
		targetId,
		propertyId,
		contextType = 'realtor',
		listingTitle,
		runtimePresetOptions,
		onNotice,
		brandVerticalSlug = 'realtor',
		listingMediaRefreshAt,
		onListingMediaChanged,
		hideBrandKit = false,
	} = props;

	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const resolvedTargetId = propertyId ?? targetId ?? '';
	const isRealtorContext = contextType === 'realtor';
	const presetOptions =
		runtimePresetOptions.length > 0
			? runtimePresetOptions
			: PW_FALLBACK_PHOTO_PRESETS;

	const [mediaRows, setMediaRows] = useState<RealtorPropertyMedia[]>([]);
	const [selectedMedia, setSelectedMedia] = useState<Record<string, boolean>>(
		{}
	);
	const [batchPreset, setBatchPreset] = useState(
		presetOptions[0]?.preset_key ?? ''
	);
	const [batchInstruction, setBatchInstruction] = useState('');
	const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
	const [batchDetail, setBatchDetail] =
		useState<RealtorMediaBatchDetail | null>(null);
	const [sseRows, setSseRows] = useState<
		Record<string, ProfessionalBatchItemProgressRow>
	>({});

	const [albums, setAlbums] = useState<ProfessionalMediaAlbum[]>([]);
	const [albumsPending, setAlbumsPending] = useState(false);
	const [albumTitleDraft, setAlbumTitleDraft] = useState('');
	const [albumRenameId, setAlbumRenameId] = useState<string | null>(null);
	const [albumRenameDraft, setAlbumRenameDraft] = useState('');
	const [albumDeleteId, setAlbumDeleteId] = useState<string | null>(null);
	const [albumDeleteTitle, setAlbumDeleteTitle] = useState('');
	const [brandKitLoaded, setBrandKitLoaded] = useState(false);
	const [brandDraft, setBrandDraft] = useState<MediaWorkbenchBrandDraft>({
		primary_hex: '',
		accent_hex: '',
		typography_note: '',
		logo_asset_hint: '',
		watermark_corner: 'none',
		watermark_padding_px: '',
	});
	const [batchBusy, setBatchBusy] = useState(false);
	const [previewContentId, setPreviewContentId] = useState<string | null>(null);
	const [previewLabel, setPreviewLabel] = useState('');
	const albumsMigrationWarnedRef = useRef(false);

	const reloadListingMedia = useCallback(async () => {
		if (!isRealtorContext || !resolvedTargetId) return;
		const rows = await listRealtorPropertyMedia(resolvedTargetId);
		setMediaRows(rows);
	}, [isRealtorContext, resolvedTargetId]);

	const reloadAlbums = useCallback(async () => {
		if (!isRealtorContext || !resolvedTargetId) return;
		setAlbumsPending(true);
		try {
			const list = await listProfessionalMediaAlbums();
			setAlbums(
				list.filter((album) =>
					albumBelongsToProperty(album.property_id, resolvedTargetId)
				)
			);
		} catch (caught: unknown) {
			setAlbums([]);
			if (
				isAlbumsSchemaMigrationError(caught) &&
				!albumsMigrationWarnedRef.current
			) {
				albumsMigrationWarnedRef.current = true;
				onNotice(t('mediaWorkbench.albumsBlockedByMigration'));
			}
		} finally {
			setAlbumsPending(false);
		}
	}, [isRealtorContext, onNotice, resolvedTargetId, t]);

	const galleryScopeLabel = useMemo(() => {
		const scopeName =
			listingTitle?.trim() || t('mediaWorkbench.galleryScopeFallbackListing');
		return t('mediaWorkbench.galleryScope', { listingTitle: scopeName });
	}, [listingTitle, t]);

	useEffect(() => {
		if (!isRealtorContext || !resolvedTargetId) return;
		void reloadListingMedia();
		void (async () => {
			try {
				const kit = await getBrandVisualKit(brandVerticalSlug);
				if (kit) {
					setBrandDraft(
						parseBrandKitDraftFromApi(kit.kit as Record<string, unknown>)
					);
				}
			} catch {
				onNotice(t('errors.load'));
			} finally {
				setBrandKitLoaded(true);
			}
		})();
	}, [
		brandVerticalSlug,
		isRealtorContext,
		onNotice,
		reloadListingMedia,
		resolvedTargetId,
		t,
	]);

	useEffect(() => {
		if (!isRealtorContext || listingMediaRefreshAt === undefined) return;
		void reloadListingMedia();
	}, [isRealtorContext, listingMediaRefreshAt, reloadListingMedia]);

	useEffect(() => {
		if (!isRealtorContext) return;
		void reloadAlbums();
	}, [isRealtorContext, reloadAlbums]);

	useEffect(() => {
		setBatchPreset(presetOptions[0]?.preset_key ?? '');
	}, [presetOptions]);

	const toggleSelect = useCallback((id: string) => {
		setSelectedMedia((curr) => ({ ...curr, [id]: !curr[id] }));
	}, []);

	const selectedIds = useMemo(
		() =>
			Object.entries(selectedMedia)
				.filter(([, v]) => v)
				.map(([cid]) => cid),
		[selectedMedia]
	);

	const runBatchFlow = useCallback(async () => {
		if (!isRealtorContext || !resolvedTargetId) return;
		if (!batchPreset.trim() || selectedIds.length === 0) return;
		setBatchBusy(true);
		setSseRows({});
		try {
			const detail = await createRealtorMediaBatch(resolvedTargetId, {
				preset_key: batchPreset,
				instruction: batchInstruction.trim() || null,
				source_content_ids: selectedIds,
				idempotency_key: createIdempotencyKey('pw-media-batch'),
				batch_meta: { ui: 'desktop-workbench' },
			});
			setBatchDetail(detail);
			setActiveBatchId(detail.batch.id);
			await streamRealtorMediaBatchRun(
				resolvedTargetId,
				detail.batch.id,
				(event, data) => {
					setSseRows((prev) =>
						reduceProfessionalBatchSseMaps(prev, {
							event,
							data: data as Record<string, unknown>,
						})
					);
				},
				(err) => {
					onNotice(`${t('mediaWorkbench.streamProblem')}: ${err}`);
				}
			);
			const refreshed = await getRealtorMediaBatchDetail(
				resolvedTargetId,
				detail.batch.id
			);
			setBatchDetail(refreshed);
			onNotice(t('mediaWorkbench.batchStreamDone'));
			void reloadListingMedia();
		} catch {
			onNotice(t('mediaWorkbench.batchError'));
		} finally {
			setBatchBusy(false);
		}
	}, [
		batchInstruction,
		batchPreset,
		isRealtorContext,
		onNotice,
		reloadListingMedia,
		resolvedTargetId,
		selectedIds,
		t,
	]);

	const enhancementById = useMemo(() => {
		const entries = batchDetail?.enhancement_jobs ?? [];
		return Object.fromEntries(entries.map((ej) => [ej.id, ej]));
	}, [batchDetail]);

	const decideLine = useCallback(
		async (
			itemId: string,
			decision: 'accepted' | 'rejected' | 'skipped' | 'pending'
		) => {
			if (
				!batchDetail?.batch?.id ||
				!decision ||
				!isRealtorContext ||
				!resolvedTargetId
			)
				return;
			try {
				const row = await reviewRealtorMediaBatchItem(
					resolvedTargetId,
					batchDetail.batch.id,
					itemId,
					decision
				);
				onNotice(`${t('mediaWorkbench.decisionRecorded')}:${row.id}`);
				const refreshed = await getRealtorMediaBatchDetail(
					resolvedTargetId,
					batchDetail.batch.id
				);
				setBatchDetail(refreshed);
				if (decision === 'accepted') {
					await reloadListingMedia();
					onListingMediaChanged?.();
				}
			} catch {
				onNotice(t('mediaWorkbench.decisionError'));
			}
		},
		[
			batchDetail?.batch?.id,
			isRealtorContext,
			onListingMediaChanged,
			onNotice,
			reloadListingMedia,
			resolvedTargetId,
			t,
		]
	);

	const createAlbumQuick = useCallback(async () => {
		if (!isRealtorContext || !resolvedTargetId) return;
		if (!albumTitleDraft.trim()) return;
		try {
			await createProfessionalMediaAlbum({
				title: albumTitleDraft.trim(),
				vertical_slug: brandVerticalSlug,
				property_id: resolvedTargetId,
				unified_content_ids: selectedIds,
			});
			onNotice(t('mediaWorkbench.albumCreated'));
			setAlbumTitleDraft('');
			await reloadAlbums();
		} catch {
			onNotice(t('mediaWorkbench.albumError'));
		}
	}, [
		albumTitleDraft,
		brandVerticalSlug,
		isRealtorContext,
		onNotice,
		reloadAlbums,
		resolvedTargetId,
		selectedIds,
		t,
	]);

	const handleDeleteAttachedMedia = useCallback(
		async (mediaId: string) => {
			if (!isRealtorContext || !resolvedTargetId || batchBusy) return;
			try {
				await deleteRealtorPropertyMedia(resolvedTargetId, mediaId);
				setSelectedMedia((curr) => {
					const next = { ...curr };
					const removed = mediaRows.find((row) => row.id === mediaId);
					if (removed) {
						delete next[removed.unified_content_id];
					}
					return next;
				});
				await reloadListingMedia();
				onNotice(t('mediaWorkbench.mediaRemoved'));
			} catch {
				onNotice(t('mediaWorkbench.mediaRemoveError'));
			}
		},
		[
			batchBusy,
			isRealtorContext,
			mediaRows,
			onNotice,
			reloadListingMedia,
			resolvedTargetId,
			t,
		]
	);

	const saveBrandKit = useCallback(async () => {
		const validation = validateProfessionalBrandKitDraft(brandDraft);
		if (!validation.ok) {
			onNotice(t(validation.messages[0] ?? 'brandKit.invalidPrimary'));
			return;
		}
		try {
			const cleaned = validation.cleaned;
			await putBrandVisualKit(
				cleaned as Record<string, unknown>,
				brandVerticalSlug
			);
			onNotice(t('mediaWorkbench.brandSaved'));
		} catch {
			onNotice(t('mediaWorkbench.brandError'));
		}
	}, [brandDraft, brandVerticalSlug, onNotice, t]);

	const renameAlbum = useCallback(
		async (albumId: string) => {
			try {
				await patchProfessionalMediaAlbum(albumId, {
					title: albumRenameDraft.trim(),
				});
				onNotice(t('mediaWorkbench.albumRenameApplied'));
			} catch {
				onNotice(t('mediaWorkbench.albumRenameError'));
			} finally {
				setAlbumRenameId(null);
				setAlbumRenameDraft('');
				void reloadAlbums();
			}
		},
		[albumRenameDraft, onNotice, reloadAlbums, t]
	);

	const confirmDeleteAlbum = useCallback(async () => {
		if (!albumDeleteId) return;
		try {
			await deleteProfessionalMediaAlbum(albumDeleteId);
			onNotice(t('mediaWorkbench.albumDeleted'));
			await reloadAlbums();
		} catch {
			onNotice(t('mediaWorkbench.albumDeleteError'));
			throw new Error('album delete failed');
		}
	}, [albumDeleteId, onNotice, reloadAlbums, t]);

	const openPreview = useCallback((contentId: string, label: string) => {
		setPreviewContentId(contentId);
		setPreviewLabel(label);
	}, []);

	const closePreview = useCallback(() => {
		setPreviewContentId(null);
	}, []);

	const closeAlbumDelete = useCallback(() => {
		setAlbumDeleteId(null);
		setAlbumDeleteTitle('');
	}, []);

	return {
		t,
		contextType,
		hideBrandKit,
		presetOptions,
		mediaRows,
		selectedMedia,
		batchPreset,
		setBatchPreset,
		batchInstruction,
		setBatchInstruction,
		activeBatchId,
		batchDetail,
		sseRows,
		albums,
		albumsPending,
		albumTitleDraft,
		setAlbumTitleDraft,
		albumRenameId,
		setAlbumRenameId,
		albumRenameDraft,
		setAlbumRenameDraft,
		albumDeleteId,
		albumDeleteTitle,
		setAlbumDeleteId,
		setAlbumDeleteTitle,
		brandKitLoaded,
		brandDraft,
		setBrandDraft,
		batchBusy,
		previewContentId,
		previewLabel,
		galleryScopeLabel,
		selectedIds,
		enhancementById,
		toggleSelect,
		runBatchFlow,
		decideLine,
		createAlbumQuick,
		handleDeleteAttachedMedia,
		saveBrandKit,
		reloadAlbums,
		renameAlbum,
		confirmDeleteAlbum,
		openPreview,
		closePreview,
		closeAlbumDelete,
	};
}

export type ProfessionalMediaWorkbenchModel = ReturnType<
	typeof useProfessionalMediaWorkbench
>;
