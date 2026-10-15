/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Media albums, enhancement jobs, batches, brand kit, and property media upload helpers for Professional Worlds desktop API.
 *
 * Invariants:
 * - All REST calls go through the canonical EliteEW API helpers.
 * - Out responses use OpenAPI-aligned Zod parsers.
 *
 * Related:
 * - api/routers/professional_worlds.py
 * - ../professionalWorldsApiZod.ts
 * - ../types.ts
 */

import type {
	BrandVisualKitOut,
	MediaEnhancementJobOut,
	ProfessionalMediaAlbumOut,
	RealtorMediaBatchDetailOut,
	RealtorMediaBatchItemOut,
	RealtorPropertyMediaOut,
} from '../professionalWorldsOpenApi';
import { api, apiFetchWithAuth } from '@/services/api/client';
import type {
	MediaEnhancementJob,
	ProfessionalMediaAlbum,
	ProfessionalMediaAlbumCreate,
	ProfessionalMediaAlbumPatch,
	RealtorMediaBatchCreate,
	RealtorMediaBatchDetail,
	RealtorMediaBatchItem,
	RealtorPropertyMedia,
} from '../types';
import {
	parseBrandVisualKitOut,
	parseBrandVisualKitUpsertBody,
	parseMediaEnhancementJobOut,
	parseMediaEnhancementJobOutList,
	parseNullableBrandVisualKitOut,
	parseProfessionalMediaAlbumCreateBody,
	parseProfessionalMediaAlbumOut,
	parseProfessionalMediaAlbumOutList,
	parseProfessionalMediaAlbumPatchBody,
	parseRealtorMediaBatchCreateBody,
	parseRealtorMediaBatchDetailOut,
	parseRealtorMediaBatchItemOut,
	parseRealtorMediaBatchItemReviewBody,
	parseRealtorPropertyMediaOut,
	parseRealtorPropertyMediaOutList,
} from '../professionalWorldsApiZod';
import { getNoCache, PROFESSIONAL_WORLDS_API_BASE } from './httpShared';

export async function uploadRealtorPropertyMedia(
	propertyId: string,
	payload: { image: File; caption?: string | null }
): Promise<RealtorPropertyMedia> {
	const formData = new FormData();
	formData.set('image', payload.image);
	if (payload.caption !== undefined && payload.caption !== null) {
		formData.set('caption', payload.caption);
	}

	const response = await apiFetchWithAuth(
		`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${propertyId}/media/upload`,
		{
			method: 'POST',
			body: formData,
		}
	);

	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const data = await response.json();
	return parseRealtorPropertyMediaOut(data);
}

export async function listMediaEnhancementJobs(
	propertyId: string
): Promise<MediaEnhancementJob[]> {
	return parseMediaEnhancementJobOutList(
		await getNoCache<MediaEnhancementJobOut[]>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${propertyId}/media/enhancements`
		)
	);
}

export async function acceptMediaEnhancement(
	propertyId: string,
	jobId: string,
	attach = true
): Promise<MediaEnhancementJob> {
	return parseMediaEnhancementJobOut(
		await api.post<MediaEnhancementJobOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${propertyId}/media/enhancements/${jobId}/accept?attach=${String(attach)}`,
			{}
		)
	);
}

export async function rejectMediaEnhancement(
	propertyId: string,
	jobId: string
): Promise<MediaEnhancementJob> {
	return parseMediaEnhancementJobOut(
		await api.post<MediaEnhancementJobOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${propertyId}/media/enhancements/${jobId}/reject`,
			{}
		)
	);
}

export async function listRealtorPropertyMedia(
	propertyId: string
): Promise<RealtorPropertyMedia[]> {
	return parseRealtorPropertyMediaOutList(
		await getNoCache<RealtorPropertyMediaOut[]>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${propertyId}/media`
		)
	);
}

export async function deleteRealtorPropertyMedia(
	propertyId: string,
	mediaId: string
): Promise<void> {
	await api.delete(
		`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${propertyId}/media/${mediaId}`
	);
}

export async function createRealtorMediaBatch(
	propertyId: string,
	payload: RealtorMediaBatchCreate
): Promise<RealtorMediaBatchDetail> {
	return parseRealtorMediaBatchDetailOut(
		await api.post<RealtorMediaBatchDetailOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${propertyId}/media/enhance/batches`,
			parseRealtorMediaBatchCreateBody(payload)
		)
	);
}

export async function getRealtorMediaBatchDetail(
	propertyId: string,
	batchId: string
): Promise<RealtorMediaBatchDetail> {
	return parseRealtorMediaBatchDetailOut(
		await api.get<RealtorMediaBatchDetailOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${propertyId}/media/enhance/batches/${batchId}`
		)
	);
}

export async function reviewRealtorMediaBatchItem(
	propertyId: string,
	batchId: string,
	itemId: string,
	decision: 'accepted' | 'rejected' | 'skipped' | 'pending'
): Promise<RealtorMediaBatchItem> {
	return parseRealtorMediaBatchItemOut(
		await api.patch<RealtorMediaBatchItemOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${propertyId}/media/enhance/batches/${batchId}/items/${itemId}/review`,
			parseRealtorMediaBatchItemReviewBody({ decision })
		)
	);
}

export async function listProfessionalMediaAlbums(): Promise<
	ProfessionalMediaAlbum[]
> {
	return parseProfessionalMediaAlbumOutList(
		await api.get<ProfessionalMediaAlbumOut[]>(
			`${PROFESSIONAL_WORLDS_API_BASE}/media/albums`
		)
	);
}

export async function createProfessionalMediaAlbum(
	payload: ProfessionalMediaAlbumCreate
): Promise<ProfessionalMediaAlbum> {
	return parseProfessionalMediaAlbumOut(
		await api.post<ProfessionalMediaAlbumOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/media/albums`,
			parseProfessionalMediaAlbumCreateBody(payload)
		)
	);
}

export async function patchProfessionalMediaAlbum(
	albumId: string,
	payload: ProfessionalMediaAlbumPatch
): Promise<ProfessionalMediaAlbum> {
	return parseProfessionalMediaAlbumOut(
		await api.patch<ProfessionalMediaAlbumOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/media/albums/${albumId}`,
			parseProfessionalMediaAlbumPatchBody(payload)
		)
	);
}

export async function deleteProfessionalMediaAlbum(
	albumId: string
): Promise<void> {
	await api.delete(
		`${PROFESSIONAL_WORLDS_API_BASE}/media/albums/${encodeURIComponent(albumId)}`
	);
}

export async function getBrandVisualKit(
	verticalSlug = 'realtor'
): Promise<BrandVisualKitOut | null> {
	return parseNullableBrandVisualKitOut(
		await api.get<BrandVisualKitOut | null>(
			`${PROFESSIONAL_WORLDS_API_BASE}/me/brand-visual-kit?vertical_slug=${encodeURIComponent(verticalSlug)}`
		)
	);
}

export async function putBrandVisualKit(
	kit: Record<string, unknown>,
	verticalSlug = 'realtor'
): Promise<BrandVisualKitOut> {
	return parseBrandVisualKitOut(
		await api.put<BrandVisualKitOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/me/brand-visual-kit?vertical_slug=${encodeURIComponent(verticalSlug)}`,
			parseBrandVisualKitUpsertBody({ kit })
		)
	);
}
