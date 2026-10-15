/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Realtor Pro marketing endpoints — price analysis, campaigns, comms, objections, channels, listing quality.
 *
 * Invariants:
 * - All REST calls go through the canonical EliteEW API helpers.
 * - Out responses use OpenAPI-aligned Zod parsers.
 *
 * Related:
 * - api/routers/professional_worlds.py
 * - ../professionalWorldsOpenApi.ts
 * - ../professionalWorldsApiZod.ts
 * - ../types.ts
 */

import { api } from '@/services/api/client';
import type {
	RealtorCommunicationLog,
	RealtorListingQualityScore,
	RealtorMarketingCampaign,
	RealtorMarketingCampaignCreate,
	RealtorMarketingCampaignUpdate,
	RealtorObjectionReply,
	RealtorObjectionReplyUpsert,
	RealtorPriceAnalysisSnapshot,
	RealtorPriceAnalysisSnapshotCreate,
	RealtorPublicationChannel,
	RealtorPublicationChannelPatch,
	RealtorPublicationChannelUpsert,
} from '../types';
import type {
	CommunicationLogCreateBody,
	RealtorCommunicationLogOut,
	RealtorListingQualityScoreOut,
	RealtorMarketingCampaignOut,
	RealtorObjectionReplyOut,
	RealtorPriceAnalysisSnapshotOut,
	RealtorPublicationChannelOut,
} from '../professionalWorldsOpenApi';
import {
	parseCommunicationLogCreateBody,
	parseMarketingCampaignCreateBody,
	parseMarketingCampaignUpdateBody,
	parseObjectionReplyUpsertBody,
	parsePriceAnalysisSnapshotCreateBody,
	parsePublicationChannelPatchBody,
	parsePublicationChannelUpsertBody,
	parseRealtorCommunicationLogOut,
	parseRealtorCommunicationLogOutList,
	parseRealtorListingQualityScoreOut,
	parseRealtorListingQualityScoreOutList,
	parseRealtorMarketingCampaignOut,
	parseRealtorMarketingCampaignOutList,
	parseRealtorObjectionReplyOut,
	parseRealtorObjectionReplyOutList,
	parseRealtorPriceAnalysisSnapshotOut,
	parseRealtorPriceAnalysisSnapshotOutList,
	parseRealtorPublicationChannelOut,
	parseRealtorPublicationChannelOutList,
} from '../professionalWorldsApiZod';
import { getNoCache, PROFESSIONAL_WORLDS_API_BASE } from './httpShared';

export async function listRealtorPriceAnalysisSnapshots(
	propertyId: string
): Promise<RealtorPriceAnalysisSnapshot[]> {
	return parseRealtorPriceAnalysisSnapshotOutList(
		await getNoCache<RealtorPriceAnalysisSnapshotOut[]>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${propertyId}/price-snapshots`
		)
	);
}

export async function createRealtorPriceAnalysisSnapshot(
	propertyId: string,
	payload: RealtorPriceAnalysisSnapshotCreate
): Promise<RealtorPriceAnalysisSnapshot> {
	return parseRealtorPriceAnalysisSnapshotOut(
		await api.post<RealtorPriceAnalysisSnapshotOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${propertyId}/price-snapshots`,
			parsePriceAnalysisSnapshotCreateBody(payload)
		)
	);
}

export interface RealtorMarketingCampaignFilters {
	propertyId?: string | null;
}

export function buildRealtorMarketingCampaignQuery(
	filters: RealtorMarketingCampaignFilters = {}
): string {
	const params = new URLSearchParams();
	if (filters.propertyId) {
		params.set('property_id', filters.propertyId);
	}
	const query = params.toString();
	return query ? `?${query}` : '';
}

export async function listRealtorMarketingCampaigns(
	filters: RealtorMarketingCampaignFilters = {}
): Promise<RealtorMarketingCampaign[]> {
	return parseRealtorMarketingCampaignOutList(
		await getNoCache<RealtorMarketingCampaignOut[]>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/marketing-campaigns${buildRealtorMarketingCampaignQuery(filters)}`
		)
	);
}

export async function createRealtorMarketingCampaign(
	payload: RealtorMarketingCampaignCreate
): Promise<RealtorMarketingCampaign> {
	return parseRealtorMarketingCampaignOut(
		await api.post<RealtorMarketingCampaignOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/marketing-campaigns`,
			parseMarketingCampaignCreateBody(payload)
		)
	);
}

export async function updateRealtorMarketingCampaign(
	campaignId: string,
	payload: RealtorMarketingCampaignUpdate
): Promise<RealtorMarketingCampaign> {
	return parseRealtorMarketingCampaignOut(
		await api.patch<RealtorMarketingCampaignOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/marketing-campaigns/${campaignId}`,
			parseMarketingCampaignUpdateBody(payload)
		)
	);
}

export interface RealtorCommunicationLogFilters {
	relatedType?: string | null;
	relatedId?: string | null;
	limit?: number | null;
}

export function buildRealtorCommunicationLogQuery(
	filters: RealtorCommunicationLogFilters = {}
): string {
	const params = new URLSearchParams();
	if (filters.relatedType) {
		params.set('related_type', filters.relatedType);
	}
	if (filters.relatedId) {
		params.set('related_id', filters.relatedId);
	}
	if (filters.limit) {
		params.set('limit', String(filters.limit));
	}
	const query = params.toString();
	return query ? `?${query}` : '';
}

export async function listRealtorCommunicationLogs(
	filters: RealtorCommunicationLogFilters = {}
): Promise<RealtorCommunicationLog[]> {
	return parseRealtorCommunicationLogOutList(
		await getNoCache<RealtorCommunicationLogOut[]>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/communication-logs${buildRealtorCommunicationLogQuery(filters)}`
		)
	);
}

export async function createRealtorCommunicationLog(
	payload: CommunicationLogCreateBody
): Promise<RealtorCommunicationLog> {
	return parseRealtorCommunicationLogOut(
		await api.post<RealtorCommunicationLogOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/communication-logs`,
			parseCommunicationLogCreateBody(payload)
		)
	);
}

export async function listRealtorObjectionReplies(): Promise<
	RealtorObjectionReply[]
> {
	return parseRealtorObjectionReplyOutList(
		await getNoCache<RealtorObjectionReplyOut[]>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/objection-replies`
		)
	);
}

export async function upsertRealtorObjectionReply(
	objectionKey: string,
	payload: RealtorObjectionReplyUpsert
): Promise<RealtorObjectionReply> {
	return parseRealtorObjectionReplyOut(
		await api.put<RealtorObjectionReplyOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/objection-replies/${encodeURIComponent(objectionKey)}`,
			parseObjectionReplyUpsertBody(payload)
		)
	);
}

export async function listRealtorPublicationChannels(
	propertyId: string
): Promise<RealtorPublicationChannel[]> {
	return parseRealtorPublicationChannelOutList(
		await getNoCache<RealtorPublicationChannelOut[]>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${propertyId}/publication-channels`
		)
	);
}

export async function upsertRealtorPublicationChannel(
	propertyId: string,
	payload: RealtorPublicationChannelUpsert
): Promise<RealtorPublicationChannel> {
	return parseRealtorPublicationChannelOut(
		await api.post<RealtorPublicationChannelOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${propertyId}/publication-channels`,
			parsePublicationChannelUpsertBody(payload)
		)
	);
}

export async function patchRealtorPublicationChannel(
	channelId: string,
	payload: RealtorPublicationChannelPatch
): Promise<RealtorPublicationChannel> {
	return parseRealtorPublicationChannelOut(
		await api.patch<RealtorPublicationChannelOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/publication-channels/${channelId}`,
			parsePublicationChannelPatchBody(payload)
		)
	);
}

export async function listRealtorListingQualityScores(
	propertyId: string
): Promise<RealtorListingQualityScore[]> {
	return parseRealtorListingQualityScoreOutList(
		await getNoCache<RealtorListingQualityScoreOut[]>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${propertyId}/listing-quality/scores`
		)
	);
}

export async function recomputeRealtorListingQuality(
	propertyId: string
): Promise<RealtorListingQualityScore> {
	return parseRealtorListingQualityScoreOut(
		await api.post<RealtorListingQualityScoreOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${propertyId}/listing-quality/recompute`,
			{}
		)
	);
}
