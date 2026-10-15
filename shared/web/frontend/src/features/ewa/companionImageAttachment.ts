/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Converts a user-selected companion vision image into the API attachment payload and a local preview URL.
 *
 * Invariants:
 * - Only companion vision allowlisted image formats are accepted.
 * - File bytes are read through `FileReader.readAsDataURL`; do not reintroduce `arrayBuffer -> binary string -> btoa`.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 * - src/features/ewa/companionVisionFormats.ts
 */

import { isCompanionVisionFile } from '@/features/ewa/companionVisionFormats';

export const COMPANION_CHAT_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

export type PendingCompanionImage = {
	mimeType: string;
	dataBase64: string;
	previewUrl: string;
};

/** Wire payload for `CompanionChatRequestBody.image_attachment`. */
export type CompanionImageAttachmentPayload = {
	mime_type: string;
	data_base64: string;
};

export function toCompanionImageAttachmentPayload(
	image: PendingCompanionImage | null | undefined
): CompanionImageAttachmentPayload | undefined {
	if (!image) return undefined;
	return {
		mime_type: image.mimeType,
		data_base64: image.dataBase64,
	};
}

function readFileAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === 'string') {
				resolve(reader.result);
				return;
			}
			reject(new Error('companion_chat_image_read_failed'));
		};
		reader.onerror = () => {
			reject(reader.error ?? new Error('companion_chat_image_read_failed'));
		};
		reader.readAsDataURL(file);
	});
}

export function extractCompanionImageDataBase64(
	dataUrl: string,
	mimeType: string
): string {
	const expectedPrefix = `data:${mimeType};base64,`;
	if (dataUrl.startsWith(expectedPrefix)) {
		return dataUrl.slice(expectedPrefix.length);
	}
	const separator = dataUrl.indexOf(',');
	if (!dataUrl.startsWith('data:') || separator === -1) {
		throw new Error('companion_chat_image_read_failed');
	}
	return dataUrl.slice(separator + 1);
}

export async function readPendingCompanionImage(
	file: File
): Promise<PendingCompanionImage> {
	if (!isCompanionVisionFile(file)) {
		throw new Error('companion_chat_image_unsupported_format');
	}
	if (file.size > COMPANION_CHAT_IMAGE_MAX_BYTES) {
		throw new Error('companion_chat_image_too_large');
	}
	const mimeType = file.type || 'image/jpeg';
	const dataUrl = await readFileAsDataUrl(file);
	const previewUrl = URL.createObjectURL(file);
	return {
		mimeType,
		dataBase64: extractCompanionImageDataBase64(dataUrl, mimeType),
		previewUrl,
	};
}
