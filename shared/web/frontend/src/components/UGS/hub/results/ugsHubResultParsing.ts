/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 */

/**
 * Purpose:
 * Parse UGS task result payloads (image/audio/text) for Hub previews and downloads.
 * Invariants:
 * - Unified content downloads use authenticated apiClient elsewhere (not raw img src).
 * Related:
 * - UgsHubResultContent.tsx, useUgsHubTaskActions.ts
 */

import type { JsonObject } from '@/types/common';
import type { UGSTask } from '../../../../hooks/api/useUgsDashboard';
import { log } from '../../../../utils/logger';

export type ImageInfo = {
	src?: string | null;
	/** Load via authenticated apiClient (Bearer); img tags cannot send Authorization header */
	unifiedContentId?: string | null;
	base64?: string | null;
	mime?: string;
	filename?: string;
	storage?: {
		provider?: string;
		filename?: string;
		subfolder?: string;
		format?: string;
	} | null;
	previewOnly?: boolean;
	hasRenderable?: boolean;
};

export type AudioInfo = {
	src?: string | null;
	unifiedContentId?: string | null;
	base64?: string | null;
	mime?: string;
	filename?: string;
	hasRenderable?: boolean;
};

export const ensureDataUri = (value: string, mime = 'image/png'): string => {
	if (!value) {
		return '';
	}
	if (value.startsWith('data:')) {
		return value;
	}
	return `data:${mime};base64,${value}`;
};

export const base64ToBlob = (base64: string, mime: string) => {
	if (!base64) {
		return null;
	}
	try {
		const binaryString =
			typeof atob === 'function' ? atob(base64) : window.atob(base64);
		const len = binaryString.length;
		const bytes = new Uint8Array(len);
		for (let i = 0; i < len; i += 1) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		return new Blob([bytes], { type: mime });
	} catch (error) {
		log.error(
			'Failed to convert base64 string to Blob',
			error as unknown as string
		);
		return null;
	}
};

export const dataUriToBlob = (dataUri: string) => {
	if (!dataUri?.startsWith('data:')) {
		return null;
	}
	const match = dataUri.match(/^data:([^;]+);base64,(.*)$/);
	if (!match) {
		return null;
	}
	const mime = match[1] || 'application/octet-stream';
	const base64 = match[2];
	if (!base64) {
		throw new Error('Invalid data URI: missing base64 data');
	}
	return base64ToBlob(base64, mime);
};
export const extractImageInfo = (
	result?: JsonObject | null
): ImageInfo | null => {
	if (!result) {
		return null;
	}

	const format = typeof result.format === 'string' ? result.format : 'png';
	const filename =
		(result.image_filename as string) ||
		(result.filename as string) ||
		undefined;
	const mimeType =
		typeof result.mime_type === 'string' ? result.mime_type : `image/${format}`;
	const candidates = [
		result.image_url,
		result.data_uri,
		result.image_data,
		result.data,
	].filter(Boolean) as string[];

	for (const candidate of candidates) {
		if (candidate.startsWith('http')) {
			return {
				src: candidate,
				filename,
				previewOnly: false,
				hasRenderable: true,
			};
		}
		if (candidate.startsWith('data:')) {
			const base64 = candidate.split(',')[1] || '';
			return {
				src: candidate,
				base64,
				mime: candidate.substring(5, candidate.indexOf(';')) || mimeType,
				filename,
				previewOnly: false,
				hasRenderable: true,
			};
		}
		const cleaned = candidate.trim();
		if (cleaned.length > 0) {
			return {
				src: ensureDataUri(cleaned, mimeType),
				base64: cleaned,
				mime: mimeType,
				filename,
				previewOnly: false,
				hasRenderable: true,
			};
		}
	}

	if (
		typeof result.content_id === 'string' &&
		result.content_id.trim() &&
		typeof mimeType === 'string' &&
		mimeType.startsWith('image/')
	) {
		return {
			unifiedContentId: result.content_id.trim(),
			mime: mimeType,
			filename,
			previewOnly: false,
			hasRenderable: true,
		};
	}

	if (Array.isArray(result.images)) {
		let previewCandidate: ImageInfo | null = null;
		for (const entry of result.images) {
			if (entry && typeof entry === 'object') {
				const info = extractImageInfo(entry as JsonObject);
				if (info?.hasRenderable) {
					return info;
				}
				if (!previewCandidate && info) {
					previewCandidate = info;
				}
			}
		}
		if (previewCandidate) {
			return previewCandidate;
		}
	}

	if (typeof result.data_preview === 'string') {
		return {
			previewOnly: true,
			hasRenderable: false,
		};
	}

	if (
		result.storage_reference &&
		typeof result.storage_reference === 'object'
	) {
		return {
			storage: result.storage_reference,
			previewOnly: true,
			hasRenderable: false,
		};
	}

	return null;
};

export const isImageType = (typeKey: string) =>
	typeKey.toLowerCase().includes('image');
export const isAudioType = (typeKey: string) => {
	const normalizedTypeKey = typeKey.toLowerCase();
	return (
		normalizedTypeKey.includes('audio') ||
		normalizedTypeKey.includes('tts') ||
		normalizedTypeKey.includes('music_generator') ||
		normalizedTypeKey.includes('voice_clone') ||
		normalizedTypeKey.includes('singing')
	);
};

export const isLikelyTextResultType = (typeKey: string) => {
	const normalizedTypeKey = typeKey.toLowerCase();
	return (
		normalizedTypeKey.includes('text') ||
		normalizedTypeKey.includes('chat') ||
		normalizedTypeKey.includes('document') ||
		normalizedTypeKey.includes('analysis') ||
		normalizedTypeKey.includes('summary') ||
		normalizedTypeKey.includes('translation') ||
		normalizedTypeKey.includes('code') ||
		normalizedTypeKey.includes('marketing') ||
		normalizedTypeKey.includes('research')
	);
};

export const extractAudioInfo = (
	result?: JsonObject | null
): AudioInfo | null => {
	if (!result) {
		return null;
	}

	/** ComfyUI music / TTS payloads: top-level or nested `result.audio[]` with base64 `data`. */
	const firstAudioEntry = (() => {
		let list: unknown = result.audio;
		if (
			!Array.isArray(list) &&
			result.result &&
			typeof result.result === 'object'
		) {
			list = (result.result as JsonObject).audio;
		}
		if (!Array.isArray(list) || list.length === 0) {
			return null;
		}
		const first = list[0];
		return first && typeof first === 'object' ? (first as JsonObject) : null;
	})();

	const mimeType =
		(typeof firstAudioEntry?.mime_type === 'string' &&
			firstAudioEntry.mime_type) ||
		(typeof firstAudioEntry?.format === 'string' &&
		firstAudioEntry.format.includes('/')
			? firstAudioEntry.format
			: null) ||
		(typeof result.mime_type === 'string'
			? result.mime_type
			: typeof result.format === 'string' && result.format.includes('/')
				? result.format
				: 'audio/mpeg');
	const filename =
		(typeof firstAudioEntry?.filename === 'string' &&
			firstAudioEntry.filename) ||
		(result.audio_filename as string) ||
		(result.filename as string) ||
		undefined;

	if (typeof result.audio_url === 'string' && result.audio_url.trim()) {
		return {
			src: result.audio_url.trim(),
			mime: mimeType,
			filename,
			hasRenderable: true,
		};
	}

	if (
		typeof result.data_uri === 'string' &&
		result.data_uri.startsWith('data:audio')
	) {
		return {
			src: result.data_uri,
			base64: result.data_uri.split(',')[1] || '',
			mime: mimeType,
			filename,
			hasRenderable: true,
		};
	}

	const rawAudioData =
		typeof firstAudioEntry?.data === 'string'
			? (firstAudioEntry.data as string)
			: typeof result.audio_data === 'string'
				? result.audio_data
				: typeof result.data === 'string' && mimeType.startsWith('audio/')
					? result.data
					: null;
	if (rawAudioData?.trim()) {
		const normalizedAudioData = rawAudioData.trim();
		if (normalizedAudioData.startsWith('data:audio')) {
			return {
				src: normalizedAudioData,
				base64: normalizedAudioData.split(',')[1] || '',
				mime: mimeType,
				filename,
				hasRenderable: true,
			};
		}

		return {
			src: `data:${mimeType};base64,${normalizedAudioData}`,
			base64: normalizedAudioData,
			mime: mimeType,
			filename,
			hasRenderable: true,
		};
	}

	const contentIdFromAudio =
		typeof firstAudioEntry?.content_id === 'string' &&
		firstAudioEntry.content_id.trim()
			? firstAudioEntry.content_id.trim()
			: typeof firstAudioEntry?.unified_content_id === 'string' &&
					firstAudioEntry.unified_content_id.trim()
				? firstAudioEntry.unified_content_id.trim()
				: typeof result.content_id === 'string' && result.content_id.trim()
					? result.content_id.trim()
					: typeof result.unified_content_id === 'string' &&
							result.unified_content_id.trim()
						? result.unified_content_id.trim()
						: null;
	const effectiveAudioMime = mimeType.startsWith('audio/')
		? mimeType
		: 'audio/mpeg';
	if (contentIdFromAudio) {
		return {
			unifiedContentId: contentIdFromAudio,
			mime: effectiveAudioMime,
			filename,
			hasRenderable: true,
		};
	}

	return null;
};

/** First content_id from UGS result (saved to unified_content) — for "В чат" deep link */
export const getContentIdFromResult = (
	result?: JsonObject | null
): string | null => {
	if (!result || typeof result !== 'object') return null;
	if (typeof result.content_id === 'string' && result.content_id.trim())
		return result.content_id.trim();
	if (
		typeof result.unified_content_id === 'string' &&
		result.unified_content_id.trim()
	) {
		return result.unified_content_id.trim();
	}
	const images = result.images;
	if (Array.isArray(images) && images.length > 0) {
		const first = images[0];
		if (
			first &&
			typeof first === 'object' &&
			typeof (first as Record<string, unknown>).content_id === 'string'
		) {
			const id = (first as Record<string, unknown>).content_id as string;
			if (id.trim()) return id.trim();
		}
	}
	return null;
};

export const hasRenderableImage = (result?: JsonObject | null) => {
	const info = extractImageInfo(result);
	return !!info?.hasRenderable && (!!info?.src || !!info?.unifiedContentId);
};

export const hasRenderableAudio = (result?: JsonObject | null) => {
	const info = extractAudioInfo(result);
	return !!info?.hasRenderable && (!!info?.src || !!info?.unifiedContentId);
};

export const isPreviewPlaceholderResult = (result?: JsonObject | null) => {
	if (!result || typeof result !== 'object') {
		return false;
	}

	if (result._preview === 'available') {
		return true;
	}

	if (result.message === 'PhotoIcon ready' && !hasRenderableImage(result)) {
		return true;
	}

	return false;
};

export const needsResultFetch = (task: UGSTask) => {
	if (task.status !== 'completed') {
		return false;
	}
	if (!task.result || isPreviewPlaceholderResult(task.result)) {
		return true;
	}
	if (isImageType(task.type_key)) {
		return !hasRenderableImage(task.result);
	}
	if (isAudioType(task.type_key)) {
		return !hasRenderableAudio(task.result);
	}
	if (isLikelyTextResultType(task.type_key)) {
		return !extractTextFromResult(task.result);
	}
	return false;
};

export const parseJSONSafely = (value: string) => {
	try {
		return JSON.parse(value);
	} catch (_error) {
		return null;
	}
};

export const stringifyJson = (value: JsonObject) => {
	try {
		return JSON.stringify(value, null, 2);
	} catch (_error) {
		return '';
	}
};

export const extractTextFromResult = (result: unknown): string | null => {
	if (!result) {
		return null;
	}

	if (typeof result === 'string') {
		return result;
	}

	if (typeof result !== 'object') {
		return null;
	}

	const record = result as Record<string, unknown>;
	const textKeys = [
		'content',
		'text',
		'response',
		'message',
		'output',
		'analysis',
		'summary',
		'transcription',
		'caption',
		'answer',
		'translated_text',
		'final_text',
	];
	for (const key of textKeys) {
		const value = record[key];
		if (typeof value === 'string' && value.trim().length > 0) {
			return value;
		}
	}

	if (Array.isArray(record.choices)) {
		for (const choice of record.choices as JsonObject[]) {
			const msg = choice.message;
			const fromMessage =
				msg &&
				typeof msg === 'object' &&
				!Array.isArray(msg) &&
				'content' in msg
					? extractTextFromResult((msg as { content: unknown }).content)
					: null;
			const content = fromMessage ?? extractTextFromResult(choice.text);
			if (content) {
				return content;
			}
		}
	}

	if (Array.isArray(record.messages)) {
		for (const message of record.messages as JsonObject[]) {
			const content = extractTextFromResult(message.content);
			if (content) {
				return content;
			}
		}
	}

	if (typeof record.result === 'string') {
		return record.result;
	}

	if (typeof record.result === 'object' && record.result) {
		const nested = extractTextFromResult(record.result);
		if (nested) {
			return nested;
		}
	}

	return null;
};
