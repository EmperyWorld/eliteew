/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Client-side image OCR for companion instrument: doc-editor OCR + transcript persist endpoint.
 *
 * Invariants:
 * - Images only (mime or filename extension); PDF and documents rejected before OCR.
 * - Persist uses ``POST /api/v1/ewa/companion-chat/ocr-turn`` (no LLM).
 *
 * Related:
 * - src/features/ewa/companionTools/CompanionOcrSourceDialog.tsx
 * - api/ewa_platform/companion/turn/companion_ocr_turn.py
 */

import type { Content } from '@/components/UnifiedContent/types';
import { API_PATHS } from '@/services/api/config';
import { apiClient } from '@/services/api/client';
import { getAuthHeader } from '@/services/authSession';
import { contentApi } from '@/services/contentApi';
import type { CompanionChatMessageResponse } from '@/services/ewa/ewaCompanionChatApi';
import { API_OPTIONS } from '@/pages/MarketingCabinet/marketingCabinetApi/config';

const DOC_EDITOR_OCR_PATH = `${API_PATHS.DOC_EDITOR}/ocr` as const;
const COMPANION_OCR_TURN_PATH = '/ewa/companion-chat/ocr-turn' as const;

const IMAGE_MIME_PREFIX = 'image/';
const IMAGE_EXTENSIONS = new Set([
	'.png',
	'.jpg',
	'.jpeg',
	'.gif',
	'.bmp',
	'.webp',
	'.tif',
	'.tiff',
]);

export type CompanionOcrSource = 'local' | 'content_manager';

export type CompanionOcrClientResult = {
	readonly filename: string;
	readonly text: string;
	readonly confidence?: number;
	readonly source: CompanionOcrSource;
	readonly unifiedContentId?: string;
};

function extensionFromName(name: string): string {
	const dot = name.lastIndexOf('.');
	if (dot < 0) return '';
	return name.slice(dot).toLowerCase();
}

export function isCompanionOcrImageFile(file: File): boolean {
	const mime = (file.type || '').trim().toLowerCase();
	if (mime.startsWith(IMAGE_MIME_PREFIX)) return true;
	return IMAGE_EXTENSIONS.has(extensionFromName(file.name));
}

export function isCompanionOcrPickerItem(item: Content): boolean {
	const mime = (item.mime_type || '').trim().toLowerCase();
	if (mime.startsWith(IMAGE_MIME_PREFIX)) return true;
	const name = (item.original_filename || item.name || item.title || '').trim();
	return IMAGE_EXTENSIONS.has(extensionFromName(name));
}

export async function performCompanionImageOcr(
	file: File,
	language = 'rus+eng'
): Promise<{ text: string; confidence?: number }> {
	if (!isCompanionOcrImageFile(file)) {
		throw new Error('companion_ocr_images_only');
	}
	const formData = new FormData();
	formData.append('file', file);
	formData.append('language', language);
	const res = await apiClient.post<{
		success?: boolean;
		error?: string;
		text?: string;
		confidence?: number;
	}>(DOC_EDITOR_OCR_PATH, formData, {
		headers: {
			...getAuthHeader(),
			'Content-Type': 'multipart/form-data',
		},
	});
	const result = res.data;
	if (result.success === false) {
		throw new Error(result.error || 'ocr_failed');
	}
	const text = (result.text || '').trim();
	if (!text) {
		throw new Error('ocr_empty_text');
	}
	return {
		text,
		confidence:
			typeof result.confidence === 'number' ? result.confidence : undefined,
	};
}

export async function performCompanionImageOcrFromContent(
	item: Content,
	language = 'rus+eng'
): Promise<CompanionOcrClientResult> {
	if (!isCompanionOcrPickerItem(item)) {
		throw new Error('companion_ocr_images_only');
	}
	const { blob, filename } = await contentApi.downloadContentBlob(item.id);
	const name =
		filename?.trim() ||
		item.original_filename?.trim() ||
		item.name?.trim() ||
		item.title?.trim() ||
		'image';
	const mime =
		blob.type || (item.mime_type || '').trim() || 'application/octet-stream';
	const file = new File([blob], name, { type: mime });
	const ocr = await performCompanionImageOcr(file, language);
	return {
		filename: name,
		text: ocr.text,
		confidence: ocr.confidence,
		source: 'content_manager',
		unifiedContentId: item.id,
	};
}

export async function performCompanionImageOcrFromLocalFile(
	file: File,
	language = 'rus+eng'
): Promise<CompanionOcrClientResult> {
	const ocr = await performCompanionImageOcr(file, language);
	return {
		filename: file.name,
		text: ocr.text,
		confidence: ocr.confidence,
		source: 'local',
	};
}

export type CompanionOcrTurnPersistRequest = {
	readonly filename: string;
	readonly ocr_text: string;
	readonly confidence?: number;
	readonly source: CompanionOcrSource;
	readonly unified_content_id?: string;
	readonly client_turn_id?: string;
};

export function formatCompanionOcrUserLine(
	filename: string,
	source: CompanionOcrSource
): string {
	const safe = filename.trim() || 'image';
	if (source === 'content_manager') {
		return `Распознай текст на изображении из контент-менеджера: ${safe}`;
	}
	return `Распознай текст на изображении: ${safe}`;
}

export async function postCompanionOcrTurn(
	body: CompanionOcrTurnPersistRequest
): Promise<CompanionChatMessageResponse> {
	const res = await apiClient.post<CompanionChatMessageResponse>(
		COMPANION_OCR_TURN_PATH,
		body,
		API_OPTIONS
	);
	return res.data;
}
