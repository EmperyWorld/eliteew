/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Generation and intake streaming endpoints for Professional Worlds desktop API.
 *
 * Invariants:
 * - Streaming helpers use authenticated fetch and parse SSE without extra dependencies.
 * - Generation/playbook SSE optional nested artifact payloads are validated before UI callbacks.
 * - Realtor object intake attaches structured intake_diagnostics to ObjectIntakePreview.
 *
 * Related:
 * - api/routers/professional_worlds.py
 * - ../professionalWorldsApiZod.ts
 * - ../types.ts
 */

import type { RealtorPropertyOut } from '../professionalWorldsOpenApi';
import { api } from '@/services/api/client';
import type {
	CoachSimulationRequest,
	MediaEnhancementRequest,
	ObjectIntakePreview,
	RealtorGenerationRequest,
	RealtorProperty,
	StreamCallbacks,
} from '../types';
import {
	parseCoachSimulationBody,
	parseMediaEnhancementRequestBody,
	parseObjectIntakeCommitRequestBody,
	parseObjectIntakeParseRequestBody,
	parseObjectIntakeStreamPreview,
	parseRealtorGenerationBody,
	parseRealtorPropertyOut,
	ProfessionalWorldsApiParseError,
} from '../professionalWorldsApiZod';
import {
	buildObjectIntakeIdempotencyKey,
	PROFESSIONAL_WORLDS_API_BASE,
	streamProfessionalWorldsFormRequest,
	streamProfessionalWorldsRequest,
} from './httpShared';

export async function streamPropertyDescription(
	propertyId: string,
	payload: RealtorGenerationRequest,
	callbacks: StreamCallbacks
): Promise<void> {
	return streamProfessionalWorldsRequest(
		`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${propertyId}/generate-description/stream`,
		parseRealtorGenerationBody(payload),
		callbacks
	);
}

export async function streamPropertyContentPack(
	propertyId: string,
	payload: RealtorGenerationRequest,
	callbacks: StreamCallbacks
): Promise<void> {
	return streamProfessionalWorldsRequest(
		`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${propertyId}/generate-content-pack/stream`,
		parseRealtorGenerationBody(payload),
		callbacks
	);
}

export async function streamCoachSimulation(
	payload: CoachSimulationRequest,
	callbacks: StreamCallbacks
): Promise<void> {
	return streamProfessionalWorldsRequest(
		`${PROFESSIONAL_WORLDS_API_BASE}/coach/simulate/stream`,
		parseCoachSimulationBody(payload),
		callbacks
	);
}

export async function streamObjectIntakeParse(
	sourceText: string,
	callbacks: StreamCallbacks & {
		onPreview?: (preview: ObjectIntakePreview) => void;
	}
): Promise<void> {
	const body = parseObjectIntakeParseRequestBody({
		source_text: sourceText,
		idempotency_key: buildObjectIntakeIdempotencyKey(),
	});
	return streamProfessionalWorldsRequest(
		`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/intake/parse/stream`,
		body,
		{
			...callbacks,
			onRawResult: (data) => {
				try {
					const preview = parseObjectIntakeStreamPreview({
						...data,
						source_text: data.source_text ?? sourceText,
					});
					if (preview) {
						callbacks.onPreview?.(preview);
					}
				} catch (err: unknown) {
					if (err instanceof ProfessionalWorldsApiParseError) {
						callbacks.onError?.(err.message);
						return;
					}
					throw err;
				}
				callbacks.onRawResult?.(data);
			},
		}
	);
}

export async function commitObjectIntake(
	jobId: string,
	acceptedFields: string[],
	targetPropertyId?: string | null
): Promise<RealtorProperty> {
	return parseRealtorPropertyOut(
		await api.post<RealtorPropertyOut>(
			`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/intake/commit`,
			parseObjectIntakeCommitRequestBody({
				job_id: jobId,
				accepted_fields: acceptedFields,
				target_property_id: targetPropertyId ?? null,
			})
		)
	);
}

export async function streamMediaEnhancement(
	propertyId: string,
	payload: Omit<
		MediaEnhancementRequest,
		'idempotency_key' | 'reuse_existing_duplicate_job'
	> & {
		idempotency_key?: string | null;
		reuse_existing_duplicate_job?: boolean;
	},
	callbacks: StreamCallbacks
): Promise<void> {
	const body = parseMediaEnhancementRequestBody({
		...payload,
		idempotency_key:
			payload.idempotency_key ??
			`media-enhance-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
	});
	return streamProfessionalWorldsRequest(
		`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${propertyId}/media/enhance/stream`,
		body,
		callbacks
	);
}

export interface MediaUploadEnhancementRequest {
	image: File;
	preset_key: string;
	instruction?: string | null;
	attach_on_complete?: boolean;
}

export async function streamMediaUploadEnhancement(
	propertyId: string,
	payload: MediaUploadEnhancementRequest,
	callbacks: StreamCallbacks
): Promise<void> {
	const formData = new FormData();
	formData.set('image', payload.image);
	formData.set('preset_key', payload.preset_key);
	if (payload.instruction) {
		formData.set('instruction', payload.instruction);
	}
	formData.set(
		'attach_on_complete',
		String(payload.attach_on_complete ?? false)
	);
	return streamProfessionalWorldsFormRequest(
		`${PROFESSIONAL_WORLDS_API_BASE}/realtor/properties/${propertyId}/media/upload-enhance/stream`,
		formData,
		callbacks
	);
}
