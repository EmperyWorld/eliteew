/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Ready-artifact resolvers for completed image, presentation, and track operations.
 *
 * Invariants:
 * - Completed artifacts require a valid unified content reference.
 *
 * Related:
 * - src/features/ewa/companionOperations/companionOperationsProgressUi.ts
 * - src/features/ewa/companionOperations/progressUi/progressUiTypes.ts
 */

import {
	isImageBackgroundIntent,
	isMusicBackgroundIntent,
	isPresentationBackgroundIntent,
	normalizeCompanionOperationStatus,
} from '@/features/ewa/companionOperations/companionOperationsDisplayFilters';
import { runUsesMusicPipelineProgress } from '@/features/ewa/companionOperations/progressUi/musicPipelineProgress';
import type {
	OperationPresentationSummary,
	OperationReadyImage,
	OperationReadyPresentation,
	OperationReadyTrack,
} from '@/features/ewa/companionOperations/progressUi/progressUiTypes';
import {
	isUnifiedContentReferenceMissing,
	normalizeUnifiedContentId,
} from '@/services/audio/playerAudioContracts';
import type { EwaCompanionTaskRun } from '@/services/ewa/ewaCompanionChatApi';

function numberFromUnknown(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value !== 'string') return null;
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : null;
}

export function resolveOperationImagePreviewUrl(
	payload: Record<string, unknown>
): string | null {
	const direct =
		typeof payload.image_url === 'string' ? payload.image_url.trim() : '';
	if (direct.startsWith('http://') || direct.startsWith('https://')) {
		return direct;
	}
	if (direct.startsWith('/')) return direct;
	const contentId = normalizeUnifiedContentId(payload) ?? '';
	if (!contentId) return direct || null;
	return `/api/v1/content/${encodeURIComponent(contentId)}/download`;
}

export function operationReadyImage(
	run: EwaCompanionTaskRun
): OperationReadyImage | null {
	const st = (run.status || '').trim().toLowerCase();
	const kind = (run.intent_kind || '').trim().toLowerCase();
	if (st !== 'completed' || !isImageBackgroundIntent(kind)) return null;
	const payload = run.result_payload || {};
	if (isUnifiedContentReferenceMissing(payload)) return null;
	const unifiedContentId = normalizeUnifiedContentId(payload) ?? '';
	const previewUrl = resolveOperationImagePreviewUrl(payload);
	if (!previewUrl) return null;
	const promptPreview =
		typeof payload.prompt_preview === 'string' && payload.prompt_preview.trim()
			? payload.prompt_preview.trim()
			: typeof run.plan_payload?.prompt_preview === 'string'
				? String(run.plan_payload.prompt_preview).trim()
				: unifiedContentId || 'image';
	const mimeType =
		typeof payload.mime_type === 'string' && payload.mime_type.trim()
			? payload.mime_type.trim()
			: null;
	const mode =
		payload.image_tool_mode === 'edit' || payload.operation_mode === 'edit'
			? 'edit'
			: kind === 'image_edit_background'
				? 'edit'
				: 'generate';
	const sourceUnifiedContentId =
		typeof payload.source_unified_content_id === 'string' &&
		payload.source_unified_content_id.trim()
			? payload.source_unified_content_id.trim()
			: typeof payload.source_content_id === 'string' &&
					payload.source_content_id.trim()
				? payload.source_content_id.trim()
				: null;
	const downloadFilename = unifiedContentId
		? `companion-image-${mode}-${unifiedContentId.slice(0, 8)}.png`
		: 'companion-image.png';
	return {
		unifiedContentId,
		promptPreview,
		previewUrl,
		downloadFilename,
		mimeType,
		mode,
		sourceUnifiedContentId,
	};
}

/** Completed image operation whose unified_content row was deleted (API tombstone). */
export function operationImageContentUnavailable(
	run: EwaCompanionTaskRun
): boolean {
	const st = (run.status || '').trim().toLowerCase();
	const kind = (run.intent_kind || '').trim().toLowerCase();
	if (st !== 'completed' || !isImageBackgroundIntent(kind)) return false;
	return isUnifiedContentReferenceMissing(run.result_payload || {});
}

export function operationPresentationSummary(
	run: EwaCompanionTaskRun
): OperationPresentationSummary | null {
	const st = (run.status || '').trim().toLowerCase();
	const kind = (run.intent_kind || '').trim().toLowerCase();
	if (!isPresentationBackgroundIntent(kind)) return null;
	const payload = run.result_payload || {};
	const plan = run.plan_payload || {};
	const stepOutput = (run.steps ?? [])
		.map((step) => step.output_payload || {})
		.reverse()
		.find((out) => Object.keys(out).length > 0);
	const jobId =
		typeof payload.ewrp_job_id === 'string' && payload.ewrp_job_id.trim()
			? payload.ewrp_job_id.trim()
			: typeof stepOutput?.ewrp_job_id === 'string' &&
					stepOutput.ewrp_job_id.trim()
				? stepOutput.ewrp_job_id.trim()
				: typeof payload.job_id === 'string' && payload.job_id.trim()
					? payload.job_id.trim()
					: '';
	const title =
		typeof payload.title === 'string' && payload.title.trim()
			? payload.title.trim()
			: typeof plan.title === 'string' && plan.title.trim()
				? plan.title.trim()
				: jobId || run.user_message?.trim() || '';
	const topic =
		typeof payload.topic === 'string' && payload.topic.trim()
			? payload.topic.trim()
			: typeof plan.topic_preview === 'string' && plan.topic_preview.trim()
				? plan.topic_preview.trim()
				: '';
	const numSlides =
		numberFromUnknown(payload.num_slides) ??
		numberFromUnknown(plan.num_slides) ??
		numberFromUnknown(stepOutput?.num_slides);
	const slidesCount =
		numberFromUnknown(payload.slides_count) ??
		numberFromUnknown(stepOutput?.slides_count) ??
		numSlides;
	const presentationTheme =
		typeof payload.presentation_theme === 'string' &&
		payload.presentation_theme.trim()
			? payload.presentation_theme.trim()
			: typeof stepOutput?.presentation_theme === 'string' &&
					stepOutput.presentation_theme.trim()
				? stepOutput.presentation_theme.trim()
				: typeof plan.presentation_theme === 'string' &&
						plan.presentation_theme.trim()
					? plan.presentation_theme.trim()
					: null;
	const pdfUrl =
		typeof payload.pdf_url === 'string' && payload.pdf_url.trim()
			? payload.pdf_url.trim()
			: null;
	const pdfDownloadToken =
		typeof payload.pdf_download_token === 'string' &&
		payload.pdf_download_token.trim()
			? payload.pdf_download_token.trim()
			: null;
	const progressRaw =
		numberFromUnknown(payload.progress) ??
		numberFromUnknown(stepOutput?.progress);
	const progress =
		st === 'completed'
			? 100
			: Math.max(0, Math.min(99, Math.round(progressRaw ?? 0)));
	return {
		jobId: jobId || null,
		title: title || (jobId ? jobId : ''),
		topic,
		numSlides,
		slidesCount,
		presentationTheme,
		pdfUrl,
		pdfDownloadToken,
		progress,
		ready: st === 'completed' && Boolean(jobId),
	};
}

export function operationReadyPresentation(
	run: EwaCompanionTaskRun
): OperationReadyPresentation | null {
	const summary = operationPresentationSummary(run);
	if (!summary?.ready || !summary.jobId) return null;
	return {
		jobId: summary.jobId,
		title: summary.title,
		topic: summary.topic,
		numSlides: summary.numSlides,
		slidesCount: summary.slidesCount,
		presentationTheme: summary.presentationTheme,
		pdfUrl: summary.pdfUrl,
		pdfDownloadToken: summary.pdfDownloadToken,
	};
}

export function operationReadyTrack(
	run: EwaCompanionTaskRun
): OperationReadyTrack | null {
	const st = (run.status || '').trim().toLowerCase();
	const kind = (run.intent_kind || '').trim().toLowerCase();
	if (
		st !== 'completed' ||
		(!isMusicBackgroundIntent(kind) &&
			kind !== 'music_play_after_generation' &&
			!(kind === 'action_workflow' && runUsesMusicPipelineProgress(run)))
	) {
		return null;
	}
	const payload = run.result_payload || {};
	if (isUnifiedContentReferenceMissing(payload)) return null;
	const unifiedContentId = normalizeUnifiedContentId(payload) ?? '';
	if (!unifiedContentId) return null;
	const trackName =
		typeof payload.track_name === 'string' && payload.track_name.trim()
			? payload.track_name.trim()
			: typeof payload.name === 'string' && payload.name.trim()
				? payload.name.trim()
				: '';
	const thumbnailUrl =
		typeof payload.thumbnail_url === 'string' && payload.thumbnail_url.trim()
			? payload.thumbnail_url.trim()
			: null;
	return { unifiedContentId, trackName, thumbnailUrl };
}

export function operationCompletedWithoutArtifact(
	run: EwaCompanionTaskRun
): boolean {
	const st = normalizeCompanionOperationStatus(String(run.status || ''));
	if (st !== 'completed') return false;
	return operationReadyTrack(run) === null && operationReadyImage(run) === null;
}
